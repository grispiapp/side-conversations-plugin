const KEY_PREFIX = "sc:lastSeenAt:";

/**
 * Defensive localStorage reader (Pitfall #5 — third-party iframe storage
 * restrictions can throw on access, not just on write). Read-only this
 * phase; the write path lands in Phase 3 (THRD-04).
 *
 * Any failure (missing key, malformed value, or a throwing `localStorage`)
 * degrades to `null` — "no record" — which matches D-07's own safe default
 * (no record ⇒ treat as unseen).
 */
export function getLastSeenAt(ticketKey: string): number | null {
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + ticketKey);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
