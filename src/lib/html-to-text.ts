/**
 * Converts an HTML comment body into plain text for the row's last-message
 * summary (UAT Defect 1, Plan 01-03). Grispi comment bodies arrive as HTML
 * (`<p>…</p>`), and rendering them verbatim showed literal tags as text.
 *
 * Security note (T-01 / UAT step 7): this is TEXT EXTRACTION, not HTML
 * rendering — the output is always placed into React text interpolation
 * (never `dangerouslySetInnerHTML`), so any HTML-ish content in a comment
 * still appears as literal text. Stripping the tags only removes the visible
 * markup noise; it never introduces an HTML rendering path.
 */
export function htmlToText(input: string): string {
  if (!input) return "";

  const withoutTags = input.replace(/<[^>]*>/g, " ");

  const decoded = withoutTags
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/gi, "'")
    // `&amp;` decoded LAST so double-encoded entities stay literal
    // (`&amp;lt;` → `&lt;`, not `<`).
    .replace(/&amp;/gi, "&");

  return decoded.replace(/\s+/g, " ").trim();
}
