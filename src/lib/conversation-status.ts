/**
 * "Sıra kimde" badge derivation + list grouping/sort (D-05, D-06, D-07, D-08).
 *
 * Pure functions — no API/localStorage access here. Callers are responsible
 * for pre-filtering comments to `publicVisible: true` (D-06: internal notes
 * never affect the badge or the sort order) and for resolving `statusId`
 * before calling `deriveBadge`.
 */

export type ConversationBadge = "yeni-yanit" | "yanit-bekleniyor" | "kapali";
export type ConversationLifecycleStatus = "open" | "solved" | "closed";

// CONFIRMED live (Plan 02 / Task 1 probe, 2026-07-23, gsocial-test tenant):
// SOLVED={id:4,name:"Solved"}, CLOSED={id:5,name:"Closed"}.
const SOLVED_STATUS_ID = 4;
const CLOSED_STATUS_ID = 5;

export function parseConversationLifecycleStatus(
  value: unknown
): ConversationLifecycleStatus {
  const raw =
    value && typeof value === "object" && "id" in value
      ? (value as { id: unknown }).id
      : value;
  const statusId =
    typeof raw === "string" || typeof raw === "number" ? Number(raw) : NaN;

  if (statusId === CLOSED_STATUS_ID) return "closed";
  if (statusId === SOLVED_STATUS_ID) return "solved";
  return "open";
}

export interface DeriveBadgePublicComment {
  createdAt: number;
  authorIsAgent: boolean;
}

export interface DeriveBadgeInput {
  statusId: number | null;
  /** MUST already be filtered to `publicVisible: true` by the caller (D-06). */
  publicComments: DeriveBadgePublicComment[];
}

export interface DeriveBadgeResult {
  badge: ConversationBadge;
  lastPublicCommentAt: number | null;
}

export function deriveBadge(input: DeriveBadgeInput): DeriveBadgeResult {
  const sorted = [...input.publicComments].sort(
    (a, b) => b.createdAt - a.createdAt
  );
  const last = sorted[0] ?? null;

  if (parseConversationLifecycleStatus(input.statusId) !== "open") {
    return { badge: "kapali", lastPublicCommentAt: last?.createdAt ?? null };
  }

  if (!last || !last.authorIsAgent) {
    // No public reply yet, or the external party spoke last. Phase 1 ships
    // with no thread-detail screen (THRD-01/THRD-04 are Phase 3), so there
    // is no code path yet that ever records a "seen" timestamp — D-07's
    // "no record ⇒ Yeni yanıt" safe default IS the rule for the whole of
    // Phase 1, not a rare edge case.
    return { badge: "yeni-yanit", lastPublicCommentAt: last?.createdAt ?? null };
  }

  return { badge: "yanit-bekleniyor", lastPublicCommentAt: last.createdAt };
}

const GROUP_ORDER: Record<ConversationBadge, number> = {
  "yeni-yanit": 0,
  "yanit-bekleniyor": 1,
  kapali: 2,
};

/**
 * Groups rows Yeni yanıt → Yanıt bekleniyor → Kapalı, and within each group
 * sorts by `lastPublicCommentAt` descending (D-08). Rows with a `null`
 * `lastPublicCommentAt` sort last within their group.
 */
export function sortConversations<
  T extends { badge: ConversationBadge; lastPublicCommentAt: number | null },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const groupDiff = GROUP_ORDER[a.badge] - GROUP_ORDER[b.badge];
    if (groupDiff !== 0) return groupDiff;
    return (b.lastPublicCommentAt ?? 0) - (a.lastPublicCommentAt ?? 0);
  });
}
