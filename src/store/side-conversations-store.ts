import { ConversationBadge, deriveBadge } from "@/lib/conversation-status";
import { htmlToText } from "@/lib/html-to-text";
import { getLastSeenAt } from "@/lib/last-seen-store";
import { SideTicketSummary, Ticket } from "@/types/grispi.type";

export type ConversationLifecycle = "open" | "solved";
export type ConversationActionBadge = Exclude<ConversationBadge, "kapali">;

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

  if (derived.badge === "kapali") {
    return {
      lifecycle: "solved",
      actionBadge: null,
      hasUnseen: false,
      lastPublicCommentAt: derived.lastPublicCommentAt,
    };
  }

  const lastSeenAt = getLastSeenAt(summary.key);
  const hasUnseen =
    derived.badge === "yeni-yanit" &&
    derived.lastPublicCommentAt !== null &&
    (lastSeenAt === null || lastSeenAt < derived.lastPublicCommentAt);

  return {
    lifecycle: "open",
    actionBadge: derived.badge,
    hasUnseen,
    lastPublicCommentAt: derived.lastPublicCommentAt,
  };
}

export function projectConversationRow(
  summary: SideTicketSummary,
  ticket: Ticket | null
): ConversationRowVM {
  if (!ticket) {
    return {
      key: summary.key,
      recipientEmail: RECIPIENT_UNKNOWN_PLACEHOLDER,
      requesterId: null,
      subject: summary.subject || summary.key,
      summary: "",
      lifecycle: "open",
      actionBadge: "yeni-yanit",
      hasUnseen: false,
      lastPublicCommentAt: null,
      hydrationFailed: true,
    };
  }

  const lastPublicComment = (ticket.comments ?? [])
    .filter((comment) => comment.publicVisible)
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  const { email: recipientEmail, requesterId } = resolveRecipientEmail(ticket);
  const state = resolveRowState(ticket, summary);
  const plainSummary = htmlToText(lastPublicComment?.body ?? "");
  const truncatedSummary =
    plainSummary.length > SUMMARY_MAX_LENGTH
      ? `${plainSummary.slice(0, SUMMARY_MAX_LENGTH)}…`
      : plainSummary;

  return {
    key: summary.key,
    recipientEmail,
    requesterId,
    subject: summary.subject || summary.key,
    summary: truncatedSummary,
    ...state,
    hydrationFailed: false,
  };
}

export function refreshConversationRowUnseen(
  row: ConversationRowVM
): ConversationRowVM {
  if (
    row.lifecycle !== "open" ||
    row.actionBadge !== "yeni-yanit" ||
    row.lastPublicCommentAt === null
  ) {
    return row.hasUnseen ? { ...row, hasUnseen: false } : row;
  }

  const lastSeenAt = getLastSeenAt(row.key);
  const hasUnseen = lastSeenAt === null || lastSeenAt < row.lastPublicCommentAt;
  return hasUnseen === row.hasUnseen ? row : { ...row, hasUnseen };
}

function sortConversationRows(rows: ConversationRowVM[]): ConversationRowVM[] {
  const groupOrder = (row: ConversationRowVM) => {
    if (row.lifecycle === "solved") return 2;
    return row.actionBadge === "yeni-yanit" ? 0 : 1;
  };

  return [...rows].sort((a, b) => {
    const groupDiff = groupOrder(a) - groupOrder(b);
    if (groupDiff !== 0) return groupDiff;
    return (b.lastPublicCommentAt ?? 0) - (a.lastPublicCommentAt ?? 0);
  });
}

export function dedupeAndSortConversationRows(
  rows: ConversationRowVM[]
): ConversationRowVM[] {
  const byKey = new Map<string, ConversationRowVM>();
  for (const row of rows) {
    if (!byKey.has(row.key)) {
      byKey.set(row.key, refreshConversationRowUnseen(row));
    }
  }
  return sortConversationRows(Array.from(byKey.values()));
}
