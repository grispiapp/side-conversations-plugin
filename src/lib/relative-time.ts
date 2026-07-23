const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Verified: new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' })
// produces "12 Tem", "5 Oca" — exact match for the mockup's compact fallback format.
const shortDate = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
});

/**
 * Turkish compact relative-time formatter (D-10). `now` is injectable for
 * deterministic tests — defaults to `Date.now()` in production use.
 */
export function formatRelativeTime(
  timestampMs: number,
  now: number = Date.now()
): string {
  const diff = now - timestampMs;

  if (diff < MINUTE) return "az önce";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} dk`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} sa`;

  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  if (timestampMs >= startOfToday - DAY && timestampMs < startOfToday) {
    return "Dün";
  }

  return shortDate.format(new Date(timestampMs));
}
