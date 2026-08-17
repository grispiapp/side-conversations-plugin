const KEY_PREFIX = "sc:infoBoxSeen:";

function storageKey(tenantId: string): string {
  return `${KEY_PREFIX}${encodeURIComponent(tenantId)}`;
}

/**
 * Defensive localStorage reader (mirrors last-seen-store.ts's Pitfall #5 —
 * third-party iframe storage restrictions can throw on access, not just on
 * write). Any failure degrades to `false` — "not seen" — so the info box
 * stays visible rather than silently disappearing.
 */
export function getInfoBoxSeen(tenantId: string): boolean {
  if (!tenantId.trim()) return false;

  try {
    return window.localStorage.getItem(storageKey(tenantId)) === "1";
  } catch {
    return false;
  }
}

/**
 * Persists that this tenant has dismissed the info box. Storage is
 * intentionally device/browser-local (D-16), tenant-scoped only (no ticket
 * dimension). Invalid input and storage denial/quota errors are non-fatal.
 */
export function setInfoBoxSeen(tenantId: string): boolean {
  if (!tenantId.trim()) return false;

  try {
    window.localStorage.setItem(storageKey(tenantId), "1");
    return true;
  } catch {
    return false;
  }
}
