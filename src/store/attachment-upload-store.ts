import { makeAutoObservable, runInAction } from "mobx";

import { RootStore } from "./root-store";

import { grispiAPI } from "@/grispi/client/api";
import { NetworkError } from "@/grispi/client/http-handler";
import { attachmentKind } from "@/lib/attachment-format";
import {
  AttachmentRejection,
  MAX_ATTACHMENT_BYTES,
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
  /**
   * Per-surface count of in-flight inline uploads (Plan 08's D-06 extension
   * — see `isUploading`'s doc-comment). Plain observable numbers, NOT
   * excluded from the observable-init call the way `fileRefs`/`generations`
   * are, since `isUploading` reads them directly and needs the reaction.
   */
  private composeInlineUploading = 0;
  private replyInlineUploading = 0;

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
   * Uploads a pasted/dropped-into-editor image (D-13 rev.) and registers it
   * into the surface's inline bucket — the FIRST and, as of this plan, ONLY
   * caller of `registerInlineImage` above (04-03 built the bucket with zero
   * callers). Contract (attachment-upload-contract.md §Inline görsel akışı):
   * the file is uploaded FIRST, the caller embeds the returned `objectUrl`
   * only after this promise resolves (D-14) — this action never returns a
   * base64/local placeholder, that transient value lives entirely in the
   * editor (Plan 08 Task 2), not here.
   *
   * Registered records NEVER enter `chips(surface)` — D-15's separate-bucket
   * rule — so they never appear in the attachment chip list. D-16's
   * submit-time garbage collection (only ids whose `objectUrl` still appears
   * in the final body HTML are bound to the outgoing comment) is already
   * implemented in `collectAttachmentIds` below and needs no changes here;
   * this action's only job is populating the bucket that read from.
   *
   * The D-08 per-file size cap is enforced before the network call (the
   * uploader is never invoked for an oversized file); D-08's count/total
   * budget is deliberately NOT applied here — that budget belongs to the
   * chip list's own batch validation (`addFiles`/`validateAttachmentBatch`),
   * and D-15 keeps the inline bucket a separate, uncounted concern.
   */
  uploadInlineImage(surface: ComposerSurface, file: File): Promise<InlineImageVM> {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return Promise.reject(
        new Error(
          `Inline image exceeds the ${MAX_ATTACHMENT_BYTES}-byte per-file cap (D-08)`
        )
      );
    }

    this.setInlineUploading(surface, this.inlineUploadCount(surface) + 1);

    // Two-argument `.then(onFulfilled, onRejected)` — NOT a trailing
    // `.catch()` — so a failure inside `onFulfilled` (e.g. a bug in
    // `registerInlineImage`) is never mistaken for an upload rejection and
    // double-decrements the counter; `onRejected` only ever fires for the
    // uploader's own promise rejection.
    return this.uploader(file, { inline: true }).then(
      (response) => {
        const image: InlineImageVM = {
          id: response.id,
          objectUrl: response.objectUrl,
        };
        runInAction(() => {
          this.registerInlineImage(surface, image);
          this.setInlineUploading(surface, this.inlineUploadCount(surface) - 1);
        });
        return image;
      },
      (error: unknown) => {
        runInAction(() => {
          this.setInlineUploading(surface, this.inlineUploadCount(surface) - 1);
        });
        throw error;
      }
    );
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

  /**
   * D-06: the send button locks while any chip OR any in-flight inline
   * upload is on this surface. The inline half of this OR is required
   * because D-06's own text ("yükleme sürerken Gönder kilitlenir") is not
   * chip-specific — sending while an inline placeholder is still mid-upload
   * would ship a body with an address-less image tag, since the placeholder
   * hasn't been swapped to its `objectUrl` yet.
   */
  isUploading(surface: ComposerSurface): boolean {
    return (
      this.chips(surface).some((chip) => chip.status === "uploading") ||
      this.inlineUploadCount(surface) > 0
    );
  }

  /**
   * D-18: a non-empty chip list OR a non-empty inline bucket counts as a
   * dirty draft, even with no text. The inline half matters because
   * `ComposeStore.isDirty` measures the body as PLAIN TEXT — a body that is
   * only a pasted screenshot renders as empty text, so without this check a
   * just-pasted image could be discarded with no "taslak kaybolacak"
   * warning at all.
   */
  hasAttachments(surface: ComposerSurface): boolean {
    return this.chips(surface).length > 0 || this.inlineImages(surface).length > 0;
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
    this.setInlineUploading(surface, 0);
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

  private inlineUploadCount(surface: ComposerSurface): number {
    return surface === "compose"
      ? this.composeInlineUploading
      : this.replyInlineUploading;
  }

  private setInlineUploading(surface: ComposerSurface, count: number): void {
    if (surface === "compose") this.composeInlineUploading = count;
    else this.replyInlineUploading = count;
  }
}
