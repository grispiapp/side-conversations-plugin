/**
 * Client-side attachment batch policy (D-08) — a UX/deliverability choice,
 * NOT a server constraint (Phase 04 Plan 01 probe A4: server accepted a
 * 30MB upload with no 413, see `04-01-SUMMARY.md` "Probe Findings"). The
 * limits exist because attachments ultimately travel by email and Gmail
 * rejects at 25MB, so client-side rejection with a clear reason is kinder
 * than a silent server-side delivery failure. Byte values are computed
 * (never hard-coded raw numbers) so the MB/count intent stays legible.
 */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB per file, D-08
export const MAX_ATTACHMENT_TOTAL_BYTES = 25 * 1024 * 1024; // 25MB total, D-08
export const MAX_ATTACHMENT_COUNT = 10; // D-08

export type AttachmentRejectionReason = "size" | "count" | "total-size";

export interface AttachmentRejection {
  file: File;
  reason: AttachmentRejectionReason;
}

export interface AttachmentValidationResult {
  accepted: File[];
  rejected: AttachmentRejection[];
}

/**
 * A minimal shape for "already attached" entries — deliberately narrower
 * than `File` so callers can pass either raw `File`s (fresh batch) or the
 * store's existing chip-list records (already-uploaded attachments), as
 * long as each carries a `size` in bytes.
 */
interface SizedEntry {
  size: number;
}

/**
 * Evaluates one incoming batch against the already-attached set, in order.
 * Rejection reason priority follows UI-SPEC §3's exact ordering: per-file
 * size first, then count, then running total — so a single oversized file
 * is never misreported as a count/total-size rejection. Partial rejection
 * (D-11): one bad file in a batch never blocks the other valid files in
 * that same batch — "ya hep ya hiç" behavior is explicitly rejected by the
 * product decision. No file-type/MIME check exists anywhere in this
 * function (D-09 — file type is never a rejection reason).
 */
export function validateAttachmentBatch(
  existingFiles: readonly SizedEntry[],
  incoming: readonly File[]
): AttachmentValidationResult {
  const accepted: File[] = [];
  const rejected: AttachmentRejection[] = [];
  let runningTotal = existingFiles.reduce((sum, f) => sum + f.size, 0);
  let runningCount = existingFiles.length;

  for (const file of incoming) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      rejected.push({ file, reason: "size" });
      continue;
    }
    if (runningCount + 1 > MAX_ATTACHMENT_COUNT) {
      rejected.push({ file, reason: "count" });
      continue;
    }
    if (runningTotal + file.size > MAX_ATTACHMENT_TOTAL_BYTES) {
      rejected.push({ file, reason: "total-size" });
      continue;
    }
    accepted.push(file);
    runningTotal += file.size;
    runningCount += 1;
  }

  return { accepted, rejected };
}

/**
 * D-16 garbage collection at submit time: an inline-pasted image's id only
 * survives into `attachmentIds` if its `objectUrl` still appears somewhere
 * in the final authored body HTML — if the agent deleted the image from the
 * editor before sending, its upload is silently dropped instead of being
 * bound to the outgoing comment. Order is preserved (matches the order
 * `inlineImages` was supplied in, not the order found in the HTML) since
 * callers may rely on a stable, deterministic `attachmentIds` ordering.
 */
export function collectSurvivingInlineImageIds(
  bodyHtml: string,
  inlineImages: readonly { id: number; objectUrl: string }[]
): number[] {
  if (!bodyHtml || inlineImages.length === 0) return [];

  return inlineImages
    .filter(({ objectUrl }) => bodyHtml.includes(objectUrl))
    .map(({ id }) => id);
}
