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
 * Decodes the small set of HTML entities relevant to attachment URLs (query
 * string separators, not general markup). Two independent encoders can touch
 * the body between upload and this GC check: the Tiptap serializer entity-
 * encodes `&` as part of normal HTML serialization (raw `objectUrl` becomes
 * `...tenant=gsocial-test&amp;objectkey=...` in `bodyHtml`), and the server
 * re-encodes on storage — `&#61;` for `=` on top of `&amp;` for `&` (04-01
 * probe finding N3). Numeric entities are decoded before the named ones so a
 * server round-tripped body (`&#61;` AND `&amp;`) resolves the same way a
 * client-side-only body (`&amp;` alone) does.
 */
function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Extracts every `objectkey` query-param value present in a (decoded) string.
 * `objectkey` is the unique-per-upload token in the upload response's
 * `objectUrl` (`?tenant=...&objectkey=<key>.grspaf`) — unlike the full URL,
 * it is never itself entity-encoded, so it is the most robust discriminator
 * once entities are decoded. Matching whole `objectkey=<value>` tokens (via
 * a Set of exact values, not substring `includes`) also avoids a false
 * positive where one upload's key happens to be a text-prefix of another's.
 */
function extractObjectKeys(html: string): Set<string> {
  const keys = new Set<string>();
  const regex = /objectkey=([^&"'\s<>]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    keys.add(match[1]);
  }
  return keys;
}

/** Single-URL variant of `extractObjectKeys` — avoids Set-destructuring under the project's `es5` TS target (no `downlevelIteration`). */
function extractObjectKey(url: string): string | undefined {
  const match = /objectkey=([^&"'\s<>]+)/.exec(url);
  return match ? match[1] : undefined;
}

/**
 * D-16 garbage collection at submit time: an inline-pasted image's id only
 * survives into `attachmentIds` if its `objectUrl` still appears somewhere
 * in the final authored body HTML — if the agent deleted the image from the
 * editor before sending, its upload is silently dropped instead of being
 * bound to the outgoing comment. Order is preserved (matches the order
 * `inlineImages` was supplied in, not the order found in the HTML) since
 * callers may rely on a stable, deterministic `attachmentIds` ordering.
 *
 * The check is entity-decoding-insensitive (bug found in Plan 08's phase-end
 * UAT on `TICKET-592`: raw `objectUrl` contains a bare `&`, but the
 * composer's serialized HTML always contains `&amp;` — a naive
 * `bodyHtml.includes(objectUrl)` never matched, so every inline image's id
 * was silently dropped from `attachmentIds` despite rendering correctly in
 * the panel). The match is done on each upload's `objectkey` token rather
 * than the whole URL string, so it also survives the server's OWN re-
 * encoding on storage (N3) and never confuses two different uploads whose
 * URLs share a common prefix.
 */
export function collectSurvivingInlineImageIds(
  bodyHtml: string,
  inlineImages: readonly { id: number; objectUrl: string }[]
): number[] {
  if (!bodyHtml || inlineImages.length === 0) return [];

  const decodedBody = decodeHtmlEntities(bodyHtml);
  const bodyObjectKeys = extractObjectKeys(decodedBody);

  return inlineImages
    .filter(({ objectUrl }) => {
      const key = extractObjectKey(objectUrl);
      if (key !== undefined) return bodyObjectKeys.has(key);
      // Fallback for a URL shape with no `objectkey` param — fall back to
      // the previous whole-URL substring check against the decoded body.
      return decodedBody.includes(objectUrl);
    })
    .map(({ id }) => id);
}
