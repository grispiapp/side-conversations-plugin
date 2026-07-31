import { makeAutoObservable, runInAction } from "mobx";

import { RootStore } from "./root-store";

import { grispiAPI } from "@/grispi/client/api";
import { NetworkError } from "@/grispi/client/http-handler";
import { attachmentKind } from "@/lib/attachment-format";
import {
  AttachmentRejection,
  collectSurvivingInlineImageIds,
  validateAttachmentBatch,
} from "@/lib/attachment-validation";
import { UploadFilesResponse } from "@/types/grispi.type";

/**
 * Compose and reply are two independent attachment "buckets" — a file added
 * while composing a new conversation must never leak into an in-progress
 * reply's chip list, and vice versa (04-CONTEXT.md's two-surface framing).
 */
export type ComposerSurface = "compose" | "reply";

/**
 * Injectable so tests can control resolve/reject timing without touching the
 * network (04-PATTERNS.md test convention). The production default below
 * binds directly to the `grispiAPI` singleton — same "store reads a module
 * singleton, not React context" precedent already used by
 * `side-conversation-queries.ts`.
 */
export type AttachmentUploader = (
  file: File,
  options?: { inline?: boolean }
) => Promise<UploadFilesResponse>;

/**
 * One row in the chip list. `previewUrl` is a LOCAL `URL.createObjectURL`
 * blob (never the remote `objectThumbUrl` — avoids a redundant fetch and
 * matches UI-SPEC §5), present only for non-SVG images (D-10). `attachmentId`
 * is the server id, populated once `status` becomes `"done"` — this is the
 * value `collectAttachmentIds` binds to the outgoing comment.
 */
export interface AttachmentChipVM {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  previewUrl?: string;
  status: "uploading" | "done" | "failed";
  errorKind?: "network" | "server";
  attachmentId?: number;
}

/**
 * An already-uploaded inline-pasted image (D-15's separate bucket — this
 * NEVER appears in `chips`). Plan 08 is the first caller of
 * `registerInlineImage`; this plan only builds the storage + GC primitive.
 */
export interface InlineImageVM {
  id: number;
  objectUrl: string;
}

let chipIdCounter = 0;

function nextChipId(): string {
  chipIdCounter += 1;
  return `chip-${chipIdCounter}`;
}

/**
 * Owns the attachment-upload lifecycle for both composer surfaces (D-05
 * immediate upload, D-06 send-lock signal, D-07 failed chip + retry, D-15
 * separate inline bucket, D-16 submit-time garbage collection, D-17
 * remove-is-reference-only). Canonical ticket/comment data stays in React
 * Query — this store owns only the client-local upload state and the raw
 * `File`/generation bookkeeping needed to run it.
 *
 * MobX shape mirrors `ActiveConversationStore`
 * (04-PATTERNS.md §`attachment-upload-store.ts`): the observable-init call's
 * second argument excludes the two fields holding raw, non-serializable
 * references (`fileRefs`, `generations`) from observability — proxying a
 * `File` object is wasteful and can interfere with its native methods
 * (04-RESEARCH.md "MobX observable.ref-less large payload" pitfall). Chip
 * arrays are ALWAYS replaced immutably (`map`/`filter`, never an in-place
 * mutation on a found element) so observers outside this store see updates.
 */
export class AttachmentUploadStore {
  private composeChips: AttachmentChipVM[] = [];
  private replyChips: AttachmentChipVM[] = [];
  private composeInline: InlineImageVM[] = [];
  private replyInline: InlineImageVM[] = [];

  /** Raw `File` objects, keyed by chip id — never proxied (see class doc). */
  private fileRefs = new Map<string, File>();
  /**
   * Per-chip upload generation counter (`compose-store.ts`'s
   * `submitGeneration` pattern, adapted per-chip). A retry or a removal
   * bumps/clears the chip's generation so a stale, late-arriving promise
   * result can never resurrect a chip the agent already dismissed — request
   * cancellation is deliberately NOT wired up (CONTEXT.md deferred item;
   * the in-flight request is left to complete, its result just gets
   * silently discarded).
   */
  private generations = new Map<string, number>();

  constructor(
    private rootStore: RootStore,
    private uploader: AttachmentUploader = (file, options) =>
      grispiAPI.attachments.upload(file, options)
  ) {
    void this.rootStore; // reserved for future cross-store reads; unused today
    makeAutoObservable<this, "fileRefs" | "generations">(
      this,
      { fileRefs: false, generations: false },
      { autoBind: true, deep: false }
    );
  }

  /** Read-only view of one surface's chip list — never mutate the result. */
  chips(surface: ComposerSurface): readonly AttachmentChipVM[] {
    return surface === "compose" ? this.composeChips : this.replyChips;
  }

  /** Read-only view of one surface's inline-image bucket (D-15). */
  inlineImages(surface: ComposerSurface): readonly InlineImageVM[] {
    return surface === "compose" ? this.composeInline : this.replyInline;
  }

  /**
   * Registers an already-uploaded inline-pasted image into the surface's
   * separate bucket (D-15). No caller exists yet in this plan — Plan 08
   * wires the Tiptap `FileHandler.onPaste` callback that calls this after
   * its own `uploader(file, { inline: true })` resolves.
   */
  registerInlineImage(surface: ComposerSurface, image: InlineImageVM): void {
    this.setInline(surface, [...this.inlineImages(surface), image]);
  }

  /**
   * Validates the incoming batch (D-08/D-11 — partial rejection, never
   * "all or nothing"), creates a chip per accepted file, and starts each
   * upload IMMEDIATELY (D-05 — the caller never awaits completion here).
   * Returns the rejected entries so the caller can surface a toast
   * (D-11/D-12); this store never shows UI itself.
   */
  addFiles(surface: ComposerSurface, files: File[]): AttachmentRejection[] {
    const { accepted, rejected } = validateAttachmentBatch(
      this.chips(surface),
      files
    );

    accepted.forEach((file) => {
      const id = nextChipId();
      this.fileRefs.set(id, file);

      const previewUrl =
        attachmentKind(file.type) === "image"
          ? URL.createObjectURL(file)
          : undefined;

      const chip: AttachmentChipVM = {
        id,
        filename: file.name,
        size: file.size,
        mimeType: file.type,
        previewUrl,
        status: "uploading",
      };
      this.setChips(surface, [...this.chips(surface), chip]);
      this.startUpload(surface, id, file);
    });

    return rejected;
  }

  /**
   * D-07: re-uploads the SAME `File` object for a chip that failed, flipping
   * it back to `"uploading"` and clearing the previous `errorKind`. No-op if
   * the chip or its underlying file is gone (e.g. removed in the meantime).
   */
  retryChip(surface: ComposerSurface, chipId: string): void {
    const file = this.fileRefs.get(chipId);
    const current = this.chips(surface);
    if (!file || !current.some((chip) => chip.id === chipId)) return;

    this.setChips(
      surface,
      current.map((chip) =>
        chip.id === chipId
          ? { ...chip, status: "uploading", errorKind: undefined }
          : chip
      )
    );
    this.startUpload(surface, chipId, file);
  }

  /**
   * D-17: removal ONLY drops the local reference — no delete request is ever
   * sent (no such endpoint is assumed; orphaned-file cleanup is the server's
   * job). Releases the local preview blob URL if one was created, and bumps
   * the chip's generation off the map so a still-in-flight upload's eventual
   * result cannot resurrect it (see `generations` doc-comment).
   */
  removeChip(surface: ComposerSurface, chipId: string): void {
    const current = this.chips(surface);
    const chip = current.find((candidate) => candidate.id === chipId);
    if (!chip) return;

    if (chip.previewUrl) URL.revokeObjectURL(chip.previewUrl);
    this.fileRefs.delete(chipId);
    this.generations.delete(chipId);
    this.setChips(
      surface,
      current.filter((candidate) => candidate.id !== chipId)
    );
  }

  /** D-06: the send button locks while any chip on this surface is uploading. */
  isUploading(surface: ComposerSurface): boolean {
    return this.chips(surface).some((chip) => chip.status === "uploading");
  }

  /** D-18: a non-empty chip list counts as a dirty draft, even with no text. */
  hasAttachments(surface: ComposerSurface): boolean {
    return this.chips(surface).length > 0;
  }

  /**
   * D-16 garbage collection at submit time: inline image ids are included
   * only if their `objectUrl` still appears in the FINAL authored body HTML
   * (the agent may have deleted the image from the editor before sending).
   * Chip ids are included only for completed (`"done"`) uploads — a failed
   * or still-uploading chip has no server id to bind. Merge order is
   * INLINE FIRST, then chips (the contract's documented order) — callers
   * that build `attachmentIds` for the outgoing request depend on this.
   */
  collectAttachmentIds(surface: ComposerSurface, finalBodyHtml: string): number[] {
    const inlineIds = collectSurvivingInlineImageIds(
      finalBodyHtml,
      this.inlineImages(surface)
    );
    const chipIds = this.chips(surface)
      .filter(
        (chip): chip is AttachmentChipVM & { attachmentId: number } =>
          chip.status === "done" && chip.attachmentId !== undefined
      )
      .map((chip) => chip.attachmentId);

    return [...inlineIds, ...chipIds];
  }

  /**
   * Clears one surface's chips and inline images, releasing every local
   * preview blob URL it held — used when a compose/reply session ends
   * (submitted or discarded) so the other surface's state is never touched.
   */
  reset(surface: ComposerSurface): void {
    this.chips(surface).forEach((chip) => {
      if (chip.previewUrl) URL.revokeObjectURL(chip.previewUrl);
      this.fileRefs.delete(chip.id);
      this.generations.delete(chip.id);
    });
    this.setChips(surface, []);
    this.setInline(surface, []);
  }

  /**
   * D-05 fire-and-forget upload start. Captures a fresh per-chip generation
   * before calling the (possibly injected) `uploader`, and only applies the
   * settled result if that generation still matches AND the chip is still
   * present in the list — this is the guard that makes `removeChip`/`retryChip`
   * safe against a stale in-flight promise resolving late.
   */
  private startUpload(
    surface: ComposerSurface,
    chipId: string,
    file: File
  ): void {
    const generation = (this.generations.get(chipId) ?? 0) + 1;
    this.generations.set(chipId, generation);

    this.uploader(file)
      .then((response) => {
        this.applyUploadResult(surface, chipId, generation, {
          status: "done",
          attachmentId: response.id,
        });
      })
      .catch((error: unknown) => {
        const errorKind: "network" | "server" =
          error instanceof NetworkError ? "network" : "server";
        this.applyUploadResult(surface, chipId, generation, {
          status: "failed",
          errorKind,
        });
      });
  }

  private applyUploadResult(
    surface: ComposerSurface,
    chipId: string,
    generation: number,
    patch: Pick<AttachmentChipVM, "status"> &
      Partial<Pick<AttachmentChipVM, "errorKind" | "attachmentId">>
  ): void {
    runInAction(() => {
      if (this.generations.get(chipId) !== generation) return;

      const current = this.chips(surface);
      if (!current.some((chip) => chip.id === chipId)) return;

      this.setChips(
        surface,
        current.map((chip) =>
          chip.id === chipId ? { ...chip, ...patch } : chip
        )
      );
    });
  }

  private setChips(surface: ComposerSurface, chips: AttachmentChipVM[]): void {
    if (surface === "compose") this.composeChips = chips;
    else this.replyChips = chips;
  }

  private setInline(surface: ComposerSurface, images: InlineImageVM[]): void {
    if (surface === "compose") this.composeInline = images;
    else this.replyInline = images;
  }
}
