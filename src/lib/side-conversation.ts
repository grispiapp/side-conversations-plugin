import { Ticket } from "@/types/grispi.type";

/**
 * The custom field key that marks a Grispi ticket as a side conversation
 * and links it back to its parent ticket.
 *
 * D-01/D-02 (locked decision, 22 Tem 2026): this key is HARD-CODED and must
 * NEVER be read from plugin settings. The field itself is provisioned
 * automatically by Grispi when the plugin is installed on a tenant — this
 * codebase only ever reads/writes its value, never its existence.
 */
export const SIDE_CONVERSATION_PARENT_FIELD_KEY = "tu.side_conversation_parent";

/**
 * `ts.requester` needs a colon-prefixed email to bind (existing or
 * newly-created) end-user to a ticket by address rather than by numeric id
 * (D-07; CONFIRMED live, Plan 02/01-01-PLAN Task 1 probe — see
 * 02-01-SUMMARY.md "Probe Findings" A4). Kept as a tiny pure wrapper (rather
 * than inlining `:${email}` at every call site) so the format is a single
 * source of truth if Grispi ever changes it.
 */
export function formatRequesterField(email: string): string {
  return `:${email}`;
}

/**
 * Pre-fills the outgoing side-ticket subject with the parent ticket's key so
 * the recipient's inbox and any later cross-referencing stay traceable back
 * to the originating Grispi ticket (D-08). Trimmed because an empty
 * `ticketTitle` must not leave a trailing space — and because Grispi's live
 * `ts.subject` field rejects an entirely empty value (422; see
 * 02-01-SUMMARY.md "Probe Findings" — empty subject constraint), so callers
 * must never pass this through untrimmed either.
 */
export function formatPrefillSubject(
  ticketKey: string,
  ticketTitle: string
): string {
  return `[${ticketKey}] ${ticketTitle}`.trim();
}

/**
 * D-01/D-02 (locked decision) — the fixed internal-note body sent alongside
 * every new side ticket's create-mutation follow-up PATCH. The text is
 * SETTINGS-INDEPENDENT and constant; the parent ticket KEY is the only
 * interpolation point. No other user-authored content (subject,
 * description, recipient) may ever enter this body (T-04.2-05) — doing so
 * would leak parent-ticket context into a note that Grispi agents outside
 * this plugin can also read. Plain text only, never composer-authored HTML —
 * no HTML-cleaning step of any kind is needed or applied here.
 */
/**
 * Minimal HTML escape for values interpolated into a note body.
 *
 * The recipient address is agent-typed input and the note is written to a
 * CUSTOMER-FACING ticket, so an unescaped interpolation would be a stored
 * injection into the host agent UI. Ticket keys are escaped too — cheaper
 * than reasoning about whether the server can ever hand back a odd key.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Renders a ticket key as a plain same-tab anchor when a URL is available,
 * or as escaped text when it is not (unresolved tenant/environment must
 * degrade to readable text, never to a broken href).
 *
 * Deliberately emits NO `target` (2026-08-17 user decision: "normal link,
 * not a new tab"). Note that when this body is rendered back inside OUR
 * panel, `normalizeAnchor` in html-sanitizer.ts re-adds `target="_blank"`
 * — that is intentional and not overridden here: a same-tab navigation
 * inside the plugin iframe would load the full agent UI into a ~300px
 * frame. The parent ticket's copy renders in Grispi's own UI, which never
 * passes through our sanitizer, so there it stays a normal same-tab link.
 */
function ticketKeyMarkup(key: string, url: string | null): string {
  const safeKey = escapeHtml(key);
  return url ? `<a href="${escapeHtml(url)}">${safeKey}</a>` : safeKey;
}

/**
 * D-02 — wording is fixed and never read from settings. Revised 2026-08-17
 * (live UAT) so the key is a link; the words themselves are unchanged.
 */
export function formatInternalNoteBody(
  parentKey: string,
  parentUrl: string | null = null
): string {
  return `Bu talep, ${ticketKeyMarkup(parentKey, parentUrl)} talebinin yan konuşmasıdır. Talep sahibi bu yazışmayı görmez.`;
}

/**
 * The PARENT ticket's counterpart note (2026-08-17 user decision, reversing
 * D-05's "üst talebe ayrıca not düşülmez"). Written to the customer's own
 * ticket, so it carries the same `publicVisible: false` guarantee as the
 * side-ticket note and names both the new side ticket and its recipient.
 */
export function formatParentLinkNoteBody(
  sideKey: string,
  recipientEmail: string | null,
  sideUrl: string | null = null
): string {
  const who = recipientEmail
    ? ` Alıcı: ${escapeHtml(recipientEmail)}.`
    : "";
  return `Bu talep için bir yan konuşma açıldı: ${ticketKeyMarkup(sideKey, sideUrl)}.${who} Talep sahibi bu yazışmayı görmez.`;
}

/**
 * Client-side UX gate only (D-06) — the server is the actual authority on
 * whether an address is deliverable via `ts.requester`. Deliberately loose
 * (not RFC 5322) per RESEARCH.md's "Don't Hand-Roll" guidance: a stricter
 * regex risks rejecting a real address the server would have accepted.
 * Trims first so incidental leading/trailing whitespace from paste/autofill
 * doesn't fail a value that is otherwise valid.
 */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * D-11/UX-03 — hydration-safe side-conversation detection.
 *
 * `switchTicket` (grispi-context.tsx) sets a PROVISIONAL ticket
 * (`{ key } as Ticket`, no field map) synchronously the instant the active
 * ticket changes, then replaces it with the full hydrated object once the
 * detail fetch resolves. Checking `ticket !== null` alone would treat that
 * provisional object as hydrated and read a field map it doesn't have yet
 * — the guard below checks the real object shape instead (`"fieldMap" in
 * ticket`), which only becomes true once hydration actually completed.
 *
 * Safe direction while hydration is still in flight: side-conversation
 * detection below returns `false`. The banner is briefly ABSENT and "Yeni
 * konuşma" stays enabled for one frame-or-two — never a false-positive
 * banner, and reading the field map before it exists never throws.
 */
export function isHydratedTicket(ticket: Ticket | null): ticket is Ticket {
  return ticket !== null && "fieldMap" in ticket;
}

/**
 * D-11 — true when the ACTIVE ticket is itself a side conversation (its own
 * parent-link field carries a value), never the other direction. Callers
 * must read this ONCE per render and feed the same result into both the
 * parent banner's visibility and the "Yeni konuşma" button's disabled
 * state — never two independent calls for the two decisions.
 */
export function isSideConversationTicket(ticket: Ticket | null): boolean {
  if (!isHydratedTicket(ticket)) return false;
  const value = ticket.fieldMap[SIDE_CONVERSATION_PARENT_FIELD_KEY]?.value;
  return typeof value === "string" && value.trim() !== "";
}

/**
 * The parent ticket's key, or `null` when `ticket` isn't a side
 * conversation (or isn't hydrated yet). Single source for both the parent
 * banner's displayed key and its deep-link input — never a second,
 * independent read of the same field.
 */
export function parentKeyOfTicket(ticket: Ticket | null): string | null {
  if (!isSideConversationTicket(ticket)) return null;
  const value = (ticket as Ticket).fieldMap[SIDE_CONVERSATION_PARENT_FIELD_KEY]
    ?.value;
  return typeof value === "string" ? value.trim() : null;
}
