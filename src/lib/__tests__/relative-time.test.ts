import { formatRelativeTime } from "../relative-time";

// Fixed reference point (local time): 23 July 2026, 12:00:00.
const NOW = new Date(2026, 6, 23, 12, 0, 0).getTime();

describe("formatRelativeTime", () => {
  it('returns "az önce" for timestamps under a minute old', () => {
    expect(formatRelativeTime(NOW - 30_000, NOW)).toBe("az önce");
  });

  it('returns "N dk" for timestamps under an hour old', () => {
    expect(formatRelativeTime(NOW - 12 * 60_000, NOW)).toBe("12 dk");
  });

  it('returns "N sa" for timestamps under a day old', () => {
    expect(formatRelativeTime(NOW - 3 * 3_600_000, NOW)).toBe("3 sa");
  });

  it('returns "Dün" for a timestamp that fell yesterday', () => {
    const yesterday = new Date(2026, 6, 22, 8, 0, 0).getTime();
    expect(formatRelativeTime(yesterday, NOW)).toBe("Dün");
  });

  it("falls back to a short Turkish date for anything older than yesterday", () => {
    const older = new Date(2026, 6, 12, 9, 0, 0).getTime();
    expect(formatRelativeTime(older, NOW)).toBe("12 Tem");
  });
});
