const KEY_PREFIX = "sc:lastSeenAt:";

/**
 * Defensive localStorage reader (Pitfall #5 — third-party iframe storage
 * restrictions can throw on access, not just on write).
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

/**
 * Persists the latest successfully viewed timestamp for one side ticket.
 *
 * Storage is intentionally device/browser-local (D-18). Invalid input and
 * storage denial/quota errors are non-fatal so opening a thread can never be
 * blocked by local seen-state bookkeeping.
 */
export function setLastSeenAt(ticketKey: string, timestamp: number): boolean {
  if (!ticketKey.trim() || !Number.isFinite(timestamp)) return false;

  try {
    window.localStorage.setItem(KEY_PREFIX + ticketKey, String(timestamp));
    return true;
  } catch {
    return false;
  }
}
