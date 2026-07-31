import { MAX_ATTACHMENT_BYTES } from "@/lib/attachment-validation";
import type { AttachmentRejection } from "@/lib/attachment-validation";

/**
 * MIME → visual-treatment class (D-19, UI-SPEC §5). `svg` is deliberately
 * its own kind, distinct from `image` — D-10's rule that SVGs are never
 * thumbnailed anywhere in the plugin (a `<script>` inside an `<img>`-embedded
 * SVG cannot execute, so the safety concern is theoretical, but this project
 * chooses one uniform "no SVG preview, ever" rule over two similar-but-
 * different rules for composer vs. thread rendering).
 */
export type AttachmentKind = "image" | "svg" | "pdf" | "video" | "file";

export function attachmentKind(mimeType: string | undefined | null): AttachmentKind {
  if (!mimeType) return "file";
  if (mimeType === "image/svg+xml") return "svg";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("video/")) return "video";
  return "file";
}

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = 1024 * 1024;

/**
 * Turkish-locale size format (UI-SPEC Copywriting Contract): plain bytes
 * under 1KB, rounded whole KB under 1MB, else one-decimal MB with a comma
 * separator (e.g. "2,4 MB") — `toLocaleString` is deliberately avoided since
 * ICU locale data availability varies across Node/browser builds; a manual
 * `toFixed` + comma-swap is a small, dependency-free, always-correct
 * implementation for this one fixed format.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < BYTES_PER_KB) {
    return `${bytes} B`;
  }
  if (bytes < BYTES_PER_MB) {
    return `${Math.round(bytes / BYTES_PER_KB)} KB`;
  }
  const mb = bytes / BYTES_PER_MB;
  return `${mb.toFixed(1).replace(".", ",")} MB`;
}

const ELLIPSIS = "…";

/**
 * Middle-truncation that never mangles the file extension (UI-SPEC's exact
 * algorithm): split into `{base, ext}` on the last `.`, keep `ext` intact,
 * and truncate `base` into a head+ellipsis+tail shape (~60/40 split of the
 * remaining budget) so the reader can still recognize both the start and
 * end of a long filename. Plain string slicing is safe for the Turkish
 * characters this project needs (ç/ğ/ı/ö/ş/ü are all single UTF-16 code
 * units, so no surrogate-pair splitting risk).
 */
export function truncateFilename(name: string, maxLength: number): string {
  if (name.length <= maxLength) return name;

  const lastDot = name.lastIndexOf(".");
  const hasExt = lastDot > 0 && lastDot < name.length - 1;
  const ext = hasExt ? name.slice(lastDot) : "";
  const base = hasExt ? name.slice(0, lastDot) : name;

  const budget = Math.max(maxLength - ext.length - ELLIPSIS.length, 1);
  const headLength = Math.max(Math.round(budget * 0.6), 1);
  const tailLength = Math.max(budget - headLength, 0);

  const head = base.slice(0, headLength);
  const tail = tailLength > 0 ? base.slice(Math.max(base.length - tailLength, 0)) : "";

  return `${head}${ELLIPSIS}${tail}${ext}`;
}

// Literal "10 MB" (not `formatFileSize(MAX_ATTACHMENT_BYTES)`, which would
// render "10,0 MB") — the Copywriting Contract's exact fixed limit label has
// no decimal, unlike the per-file {size} value next to it.
const REJECTION_SIZE_LIMIT_LABEL = `${MAX_ATTACHMENT_BYTES / BYTES_PER_MB} MB`;
const REJECTION_COUNT_MESSAGE = "En fazla 10 dosya ekleyebilirsiniz.";
const REJECTION_TOTAL_SIZE_MESSAGE = "Toplam ek boyutu 25 MB sınırını aşıyor.";
const REJECTION_OVERFLOW_VISIBLE_LINES = 3;

/**
 * Builds the rejection-toast body lines (UI-SPEC Copywriting Contract,
 * D-11). Per-file lines only apply to "size" rejections (each names its own
 * file/size); "count"/"total-size" rejections collapse to one fixed
 * sentence each occurrence, matching the exact copy in the contract. When
 * more than 3 rejections exist, only the first 3 lines are shown plus one
 * overflow line — never an unbounded toast.
 */
export function rejectionToastLines(
  rejections: readonly AttachmentRejection[]
): string[] {
  const lines = rejections.map((rejection) => {
    if (rejection.reason === "size") {
      return `${rejection.file.name} — ${formatFileSize(rejection.file.size)}, sınır ${REJECTION_SIZE_LIMIT_LABEL}`;
    }
    if (rejection.reason === "count") {
      return REJECTION_COUNT_MESSAGE;
    }
    return REJECTION_TOTAL_SIZE_MESSAGE;
  });

  if (lines.length <= REJECTION_OVERFLOW_VISIBLE_LINES) {
    return lines;
  }

  const visible = lines.slice(0, REJECTION_OVERFLOW_VISIBLE_LINES);
  const overflowCount = lines.length - REJECTION_OVERFLOW_VISIBLE_LINES;
  return [...visible, `+${overflowCount} dosya daha`];
}
