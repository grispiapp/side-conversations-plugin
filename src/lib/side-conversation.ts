/**
 * The single custom field key that marks a Grispi ticket as a "side ticket"
 * (a yan görüşme) and links it back to its parent ticket.
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
