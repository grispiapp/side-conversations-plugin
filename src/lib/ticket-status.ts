/**
 * Ticket status → single-letter tag, mirrored from grispi-ui's `MiniTag`
 * (`src/components/MiniTag.tsx` + `styles/theme.ts` `tagBackgroundColors`,
 * read 2026-08-17) so the plugin speaks the host agent UI's own visual
 * language instead of inventing a second one.
 *
 * Carried over verbatim:
 *  - the six status names and their antd palette colors
 *  - `On Hold` → "H", which grispi-ui hardcodes rather than deriving. The
 *    Turkish label is "Askıda", so a naive first-character rule would emit
 *    "A" and collide with "Açık". Deriving letters mechanically would
 *    reintroduce exactly the ambiguity the host UI already solved.
 *
 * Deliberately changed: keyed on the status NAME, never the numeric id.
 * grispi-ui keys on the name too, and only two ids are probe-confirmed on
 * our side (Solved=4, Closed=5 — see conversation-status.ts), so an
 * id-keyed map would be guesswork for the other four.
 */

export interface TicketStatusTag {
  /** Single letter shown in the square. */
  letter: string;
  /** Full Turkish label — accessible name / tooltip, never truncated away. */
  label: string;
  /** antd palette hex, mirrored from grispi-ui's tagBackgroundColors. */
  color: string;
}

const STATUS_TAGS: Record<string, TicketStatusTag> = {
  New: { letter: "Y", label: "Yeni", color: "#fa8c16" },
  Open: { letter: "A", label: "Açık", color: "#fa541c" },
  Pending: { letter: "B", label: "Beklemede", color: "#722ed1" },
  "On Hold": { letter: "H", label: "Askıda", color: "#404040" },
  Solved: { letter: "Ç", label: "Çözüldü", color: "#389e0d" },
  Closed: { letter: "K", label: "Kapandı", color: "#666666" },
};

/**
 * Returns `null` for an unknown/absent status rather than guessing a letter:
 * a wrong single character is harder to notice than a missing tag.
 */
export function resolveTicketStatusTag(
  statusName: string | null | undefined
): TicketStatusTag | null {
  if (!statusName) return null;
  return STATUS_TAGS[statusName.trim()] ?? null;
}
