import {
  CLOSED_STATUS_ID,
  ConversationBadge,
  ConversationLifecycleStatus,
  SOLVED_STATUS_ID,
  deriveBadge,
  parseConversationLifecycleStatus,
} from "@/lib/conversation-status";
import { htmlToText } from "@/lib/html-to-text";
import { getLastSeenAt } from "@/lib/last-seen-store";
import { SideTicketSummary, Ticket } from "@/types/grispi.type";

export type ConversationLifecycle = ConversationLifecycleStatus;
export type ConversationActionBadge = Exclude<ConversationBadge, "closed">;

export interface ConversationRowVM {
  key: string;
  recipientEmail: string;
  requesterId: number | null;
  subject: string;
  summary: string;
  lifecycle: ConversationLifecycle;
  actionBadge: ConversationActionBadge | null;
  hasUnseen: boolean;
  lastPublicCommentAt: number | null;
  hydrationFailed: boolean;
  /**
   * Raw status NAME from advanced-search, kept alongside `lifecycle`.
   * `lifecycle` collapses six statuses into three buckets (open/solved/
   * closed), which cannot tell Yeni from Açık from Beklemede — the
   * single-letter status tag needs the uncollapsed value.
   */
  statusName: string | null;
}

const SUMMARY_MAX_LENGTH = 140;
export const RECIPIENT_UNKNOWN_PLACEHOLDER = "—";

function resolveRecipientEmail(ticket: Ticket): {
  email: string;
  requesterId: number | null;
} {
  const requesterValue = ticket.fieldMap?.["ts.requester"]?.value;
  const numericId = requesterValue != null ? Number(requesterValue) : NaN;
  const requesterId = Number.isFinite(numericId) ? numericId : null;

  if (requesterId !== null) {
    const matchedCreator = (ticket.comments ?? []).find(
      (comment) => comment.creator?.id === requesterId
    )?.creator;
    if (matchedCreator?.email) {
      return { email: matchedCreator.email, requesterId };
    }
  }

  return { email: RECIPIENT_UNKNOWN_PLACEHOLDER, requesterId };
}

function truncateSummary(text: string): string {
  return text.length > SUMMARY_MAX_LENGTH
    ? `${text.slice(0, SUMMARY_MAX_LENGTH)}…`
    : text;
}

function resolveRowState(
  ticket: Ticket,
  summary: SideTicketSummary
): Pick<
  ConversationRowVM,
  "lifecycle" | "actionBadge" | "hasUnseen" | "lastPublicCommentAt"
> {
  const publicComments = (ticket.comments ?? [])
    .filter((comment) => comment.publicVisible)
    .map((comment) => ({
      createdAt: comment.createdAt,
      authorIsAgent: comment.creator?.role?.authority !== "ROLE_END_USER",
    }));
  const derived = deriveBadge({
    statusId: summary.status?.id ?? null,
    publicComments,
  });
  const lifecycle = parseConversationLifecycleStatus(
    summary.status?.id ?? null
  );

  // Task 2 (B2): the unread dot is no longer computed here. This queryFn
  // ran on every fetch, but `dedupeAndSortConversationRows` already
  // recomputes it at render time via `refreshConversationRowUnseen` a few
  // lines downstream — this `localStorage` read was dead weight. Render
  // time is now the single owner of `hasUnseen`.
  if (lifecycle !== "open") {
    return {
      lifecycle,
      actionBadge: null,
      hasUnseen: false,
      lastPublicCommentAt: derived.lastPublicCommentAt,
    };
  }

  return {
    lifecycle: "open",
    actionBadge: derived.badge === "closed" ? null : derived.badge,
    hasUnseen: false,
    lastPublicCommentAt: derived.lastPublicCommentAt,
  };
}

export function projectConversationRow(
  summary: SideTicketSummary,
  ticket: Ticket | null
): ConversationRowVM {
  if (!ticket) {
    const lifecycle = parseConversationLifecycleStatus(
      summary.status?.id ?? null
    );
    return {
      key: summary.key,
      recipientEmail: RECIPIENT_UNKNOWN_PLACEHOLDER,
      requesterId: null,
      subject: summary.subject || summary.key,
      summary: "",
      lifecycle,
      actionBadge: null,
      hasUnseen: false,
      lastPublicCommentAt: null,
      hydrationFailed: true,
      statusName: summary.status?.name ?? null,
    };
  }

  const lastPublicComment = (ticket.comments ?? [])
    .filter((comment) => comment.publicVisible)
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  const { email: recipientEmail, requesterId } = resolveRecipientEmail(ticket);
  const state = resolveRowState(ticket, summary);
  const truncatedSummary = truncateSummary(
    htmlToText(lastPublicComment?.body ?? "")
  );

  return {
    key: summary.key,
    recipientEmail,
    requesterId,
    subject: summary.subject || summary.key,
    summary: truncatedSummary,
    ...state,
    hydrationFailed: false,
    statusName: summary.status?.name ?? null,
  };
}

/** Narrow structural shape `patchConversationRowFromDetail` needs from a
 * fresh `SideConversationDetail` message — defined here (not imported from
 * side-conversation-queries.ts) because that module already imports FROM
 * this store; importing back would be a cycle. `MessageVM` is structurally
 * assignable to this, no conversion required at the call site. */
export interface DetailMessageForRowPatch {
  createdAt: number;
  direction: "own" | "incoming";
  internal?: boolean;
  body: string;
}

export interface DetailForRowPatch {
  lifecycle: ConversationLifecycleStatus;
  messages: readonly DetailMessageForRowPatch[];
}

/**
 * B3 (Task 2) — patches a single list row from a just-refetched detail
 * instead of relying on the (now network-free) list invalidate to
 * eventually refetch. `deriveBadge` wants a numeric status id; the detail
 * only carries the narrowed lifecycle, so it's reverse-mapped to the two
 * probe-confirmed ids from conversation-status.ts ("open" passes null,
 * which `parseConversationLifecycleStatus` already resolves to "open").
 *
 * `statusName` is written only when the new lifecycle PROVES it (closed,
 * solved, or reopen-to-open); a bare "open" alone covers three real
 * statuses (Yeni/Açık/Beklemede) the detail can't distinguish between, so
 * the row's existing name is left untouched rather than guessed — an
 * eventual real fetch (via the invalidate this patch runs alongside)
 * still corrects it.
 */
export function patchConversationRowFromDetail(
  row: ConversationRowVM,
  detail: DetailForRowPatch
): ConversationRowVM {
  const publicMessages = detail.messages.filter(
    (message) => !message.internal
  );
  const publicComments = publicMessages.map((message) => ({
    createdAt: message.createdAt,
    authorIsAgent: message.direction === "own",
  }));
  const statusId =
    detail.lifecycle === "closed"
      ? CLOSED_STATUS_ID
      : detail.lifecycle === "solved"
        ? SOLVED_STATUS_ID
        : null;
  const derived = deriveBadge({ statusId, publicComments });
  const lastPublicMessage = [...publicMessages].sort(
    (a, b) => b.createdAt - a.createdAt
  )[0];

  const statusName =
    detail.lifecycle === "closed"
      ? "Closed"
      : detail.lifecycle === "solved"
        ? "Solved"
        : detail.lifecycle === "open" && row.lifecycle !== "open"
          ? "Open"
          : row.statusName;

  return {
    ...row,
    lifecycle: detail.lifecycle,
    actionBadge:
      detail.lifecycle === "open" && derived.badge !== "closed"
        ? derived.badge
        : null,
    lastPublicCommentAt: derived.lastPublicCommentAt,
    summary: truncateSummary(htmlToText(lastPublicMessage?.body ?? "")),
    // Render-time-owned (same B2 contract as resolveRowState above); a
    // mutation patch never has enough information to prove "still unseen"
    // either way.
    hasUnseen: false,
    statusName,
  };
}

export function refreshConversationRowUnseen(
  tenantId: string,
  row: ConversationRowVM
): ConversationRowVM {
  if (
    row.lifecycle !== "open" ||
    row.actionBadge !== "new-reply" ||
    row.lastPublicCommentAt === null
  ) {
    return row.hasUnseen ? { ...row, hasUnseen: false } : row;
  }

  const lastSeenAt = getLastSeenAt(tenantId, row.key);
  const hasUnseen = lastSeenAt === null || lastSeenAt < row.lastPublicCommentAt;
  return hasUnseen === row.hasUnseen ? row : { ...row, hasUnseen };
}

function sortConversationRows(rows: ConversationRowVM[]): ConversationRowVM[] {
  const groupOrder = (row: ConversationRowVM) => {
    if (row.lifecycle !== "open") return 2;
    return row.actionBadge === "new-reply" ? 0 : 1;
  };

  return [...rows].sort((a, b) => {
    const groupDiff = groupOrder(a) - groupOrder(b);
    if (groupDiff !== 0) return groupDiff;
    return (b.lastPublicCommentAt ?? 0) - (a.lastPublicCommentAt ?? 0);
  });
}

export function dedupeAndSortConversationRows(
  tenantId: string,
  rows: ConversationRowVM[]
): ConversationRowVM[] {
  const byKey = new Map<string, ConversationRowVM>();
  for (const row of rows) {
    if (!byKey.has(row.key)) {
      byKey.set(row.key, refreshConversationRowUnseen(tenantId, row));
    }
  }
  return sortConversationRows(Array.from(byKey.values()));
}
