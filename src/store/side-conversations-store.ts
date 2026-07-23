import { makeAutoObservable, runInAction } from "mobx";

import { grispiAPI } from "@/grispi/client/api";
import { HttpError, NetworkError } from "@/grispi/client/http-handler";
import {
  ConversationBadge,
  deriveBadge,
  sortConversations,
} from "@/lib/conversation-status";
import { getLastSeenAt } from "@/lib/last-seen-store";
import { SIDE_CONVERSATION_PARENT_FIELD_KEY } from "@/lib/side-conversation";
import { SideTicketSummary, Ticket } from "@/types/grispi.type";

import { RootStore } from "./root-store";

export type ConversationsListStatus = "loading" | "ready" | "empty" | "error";

export interface ConversationRowVM {
  key: string;
  recipientEmail: string;
  subject: string;
  summary: string;
  badge: ConversationBadge;
  lastPublicCommentAt: number | null;
  hydrationFailed: boolean;
}

const SUMMARY_MAX_LENGTH = 140;

/**
 * Resolves the side ticket's requester ("alıcı") email.
 *
 * CONFIRMED live (Plan 02 / Task 1 probe): `fieldMap["ts.requester"].value`
 * is a user id STRING, not an email/name — and no `fieldMap` entry ever
 * carries `userFriendlyValue`. There is also no public `GET /users/{id}`
 * endpoint wired into this codebase (adding one is out of this plan's scope
 * — Rule 4). The cheapest correct resolution without a new API call:
 * match that id against `comments[].creator.id` — the external party will
 * have written at least one comment on every side ticket in practice. Falls
 * back to the ticket key when no match is found (e.g. an agent-only thread
 * with no external comment yet).
 */
function resolveRecipientEmail(ticket: Ticket, summary: SideTicketSummary): string {
  const requesterId = ticket.fieldMap?.["ts.requester"]?.value;
  const numericId = requesterId != null ? Number(requesterId) : NaN;

  if (Number.isFinite(numericId)) {
    const matchedCreator = (ticket.comments ?? []).find(
      (comment) => comment.creator?.id === numericId
    )?.creator;
    if (matchedCreator?.email) return matchedCreator.email;
  }

  return summary.key;
}

/**
 * Derives the "sıra kimde" badge for a hydrated ticket (D-05/06/07).
 *
 * `statusId` is read from the advanced-search SUMMARY (`summary.status.id`)
 * rather than the hydrated ticket's `fieldMap["ts.status"]` — CONFIRMED live
 * (Task 1 probe) that the summary always carries status inline as a number,
 * so the badge never depends on hydration succeeding for the closed check.
 * `publicComments` are pre-filtered to `publicVisible: true` (D-06) and
 * mapped to `authorIsAgent` via `creator.role.authority !== "ROLE_END_USER"`
 * — CONFIRMED live that `teamUser` alone is unreliable (integration/AI users
 * also report `teamUser: false`).
 */
function resolveBadge(
  ticket: Ticket,
  summary: SideTicketSummary
): { badge: ConversationBadge; lastPublicCommentAt: number | null } {
  const publicComments = (ticket.comments ?? [])
    .filter((comment) => comment.publicVisible)
    .map((comment) => ({
      createdAt: comment.createdAt,
      authorIsAgent: comment.creator?.role?.authority !== "ROLE_END_USER",
    }));

  const statusId = summary.status?.id ?? null;
  const derived = deriveBadge({ statusId, publicComments });

  if (derived.badge !== "yeni-yanit" || derived.lastPublicCommentAt === null) {
    return derived;
  }

  // D-07: an external-authored last comment is "yeni-yanit" only while
  // unseen. No writer exists before Phase 3 (THRD-04), so getLastSeenAt is
  // always null today and this always stays "yeni-yanit" — wiring the read
  // side now means Phase 3 only has to add the write.
  const lastSeenAt = getLastSeenAt(summary.key);
  const isUnseen = lastSeenAt === null || lastSeenAt < derived.lastPublicCommentAt;

  return isUnseen ? derived : { ...derived, badge: "yanit-bekleniyor" };
}

/**
 * Maps a hydrated `Ticket` (or a hydration failure) into a row view model.
 *
 * Recipient/subject resolution was corrected against CONFIRMED live shapes
 * captured in the Plan 02 / Task 1 probe (see
 * `.planning/phases/01-.../01-02-probe-findings.md`): `subject` lives on the
 * advanced-search SUMMARY (`summary.subject`), not on any `fieldMap` key —
 * a full-ticket `ts.subject` field does not exist.
 */
function toRow(
  summary: SideTicketSummary,
  ticket: Ticket | null,
  hydrationFailed: boolean
): ConversationRowVM {
  if (!ticket) {
    // No status data without hydration — safe default (D-07), stays dim via
    // `hydrationFailed`.
    return {
      key: summary.key,
      recipientEmail: summary.key,
      subject: summary.subject || summary.key,
      summary: "",
      badge: "yeni-yanit",
      lastPublicCommentAt: null,
      hydrationFailed: true,
    };
  }

  const lastPublicComment = (ticket.comments ?? [])
    .filter((comment) => comment.publicVisible)
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  const recipientEmail = resolveRecipientEmail(ticket, summary);
  const subject = summary.subject || summary.key;
  const { badge, lastPublicCommentAt } = resolveBadge(ticket, summary);

  const rawSummary = lastPublicComment?.body ?? "";
  const truncatedSummary =
    rawSummary.length > SUMMARY_MAX_LENGTH
      ? `${rawSummary.slice(0, SUMMARY_MAX_LENGTH)}…`
      : rawSummary;

  return {
    key: summary.key,
    recipientEmail,
    subject,
    summary: truncatedSummary,
    badge,
    lastPublicCommentAt,
    hydrationFailed,
  };
}

export class SideConversationsStore {
  rootStore: RootStore;
  status: ConversationsListStatus = "loading";
  rows: ConversationRowVM[] = [];
  page = 0;
  error: NetworkError | HttpError | null = null;

  private generation = 0;

  constructor(rootStore: RootStore) {
    makeAutoObservable(this);

    this.rootStore = rootStore;
  }

  /**
   * Fetches the side conversations attached to `parentKey` via the two-tier
   * advancedSearch → Promise.allSettled(getTicket) pipeline (D-09). Clears
   * state synchronously so a ticket switch never shows stale data (D-15),
   * and guards against overlapping fetch cycles with a generation counter
   * (Pitfall #6) — a slower, older `load` call can never overwrite a newer
   * one's result.
   */
  async load(parentKey: string) {
    this.status = "loading";
    this.rows = [];
    this.page = 0;
    this.error = null;

    const gen = ++this.generation;

    try {
      const response = await grispiAPI.tickets.advancedSearch(
        {
          allConditions: [
            {
              fieldKey: SIDE_CONVERSATION_PARENT_FIELD_KEY,
              operator: "EQUAL",
              value: parentKey,
            },
          ],
          anyConditions: [],
        },
        { size: 10, page: 0 }
      );

      if (gen !== this.generation) return;

      const hydrated = await Promise.allSettled(
        response.content.map((row) => grispiAPI.tickets.getTicket(row.key))
      );

      if (gen !== this.generation) return;

      const rows = hydrated.map((outcome, index) => {
        const summary = response.content[index];
        return outcome.status === "fulfilled"
          ? toRow(summary, outcome.value, false)
          : toRow(summary, null, true);
      });

      // Group/sort only after hydration has fully settled (D-08) — never
      // render/reorder mid-fetch (Anti-Pattern: reorder flash).
      const sortedRows = sortConversations(rows);

      runInAction(() => {
        this.rows = sortedRows;
        this.status = sortedRows.length ? "ready" : "empty";
      });
    } catch (err) {
      if (gen !== this.generation) return;

      runInAction(() => {
        this.error =
          err instanceof NetworkError || err instanceof HttpError ? err : null;
        this.status = "error";
      });
    }
  }
}
