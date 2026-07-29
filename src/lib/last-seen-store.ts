const KEY_PREFIX = "sc:lastSeenAt:";

function storageKey(tenantId: string, ticketKey: string): string {
  return `${KEY_PREFIX}${encodeURIComponent(tenantId)}:${encodeURIComponent(ticketKey)}`;
}

/**
 * Defensive localStorage reader (Pitfall #5 — third-party iframe storage
 * restrictions can throw on access, not just on write).
 *
 * Any failure (missing key, malformed value, or a throwing `localStorage`)
 * degrades to `null` — "no record" — which matches D-07's own safe default
 * (no record ⇒ treat as unseen).
 */
export function getLastSeenAt(
  tenantId: string,
  ticketKey: string
): number | null {
  if (!tenantId.trim() || !ticketKey.trim()) return null;

  try {
    const raw = window.localStorage.getItem(storageKey(tenantId, ticketKey));
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
export function setLastSeenAt(
  tenantId: string,
  ticketKey: string,
  timestamp: number
): boolean {
  if (
    !tenantId.trim() ||
    !ticketKey.trim() ||
    !Number.isFinite(timestamp)
  ) {
    return false;
  }

  try {
    window.localStorage.setItem(
      storageKey(tenantId, ticketKey),
      String(timestamp)
    );
    return true;
  } catch {
    return false;
  }
}
