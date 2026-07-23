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
import {
  AdvancedSearchResponse,
  SideTicketSummary,
  Ticket,
} from "@/types/grispi.type";

import { RootStore } from "./root-store";

export type ConversationsListStatus = "loading" | "ready" | "empty" | "error";

export interface ConversationRowVM {
  key: string;
  recipientEmail: string;
  /** Requester user id (parsed from `fieldMap["ts.requester"].value`), used
   * to schedule the background `GET /users/{id}` recipient-email lookup.
   * `null` when unknown (e.g. hydration itself failed). */
  requesterId: number | null;
  subject: string;
  summary: string;
  badge: ConversationBadge;
  lastPublicCommentAt: number | null;
  hydrationFailed: boolean;
}

const SUMMARY_MAX_LENGTH = 140;
const PAGE_SIZE = 10;

/**
 * Neutral placeholder shown while (or if) the recipient's email cannot be
 * resolved. MUST NEVER be the raw ticket key (LIST-01) — a side ticket key
 * like "TICKET-569" is an internal identifier, not an "alıcı" (recipient),
 * and rendering it as one was a confirmed gap (6/13 rows on the live test
 * dataset — see 01-02-probe-findings.md "EK BULGULAR" #2 and the Plan 01-03
 * orchestrator note).
 */
const RECIPIENT_UNKNOWN_PLACEHOLDER = "—";

/**
 * Resolves the side ticket's requester ("alıcı") email.
 *
 * CONFIRMED live (Plan 02 / Task 1 probe): `fieldMap["ts.requester"].value`
 * is a user id STRING, not an email/name. The cheapest correct resolution
 * without a new API call is matching that id against `comments[].creator.id`
 * — the external party will usually have written at least one comment.
 *
 * GAP CLOSURE (Plan 01-03 orchestrator note): when no comment-creator match
 * exists yet (agent-only threads — the COMMON case for a fresh side
 * conversation, confirmed 6/13 rows on the live test dataset), this used to
 * fall back to the raw ticket key, violating LIST-01 ("alıcı must be
 * shown"). It now returns a neutral placeholder + the parsed `requesterId`;
 * the store schedules a background `GET /public/v1/users/{id}` lookup
 * (CONFIRMED live and working, though undocumented — see
 * 01-02-probe-findings.md "EK BULGULAR" #2) to resolve `primaryEmail` and
 * silently upgrade the row in place. If that lookup also fails, the
 * placeholder stays — the raw ticket key is NEVER rendered as "alıcı".
 */
function resolveRecipientEmail(
  ticket: Ticket
): { email: string; requesterId: number | null } {
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
    // No status/requester data without hydration — safe default (D-07),
    // stays dim via `hydrationFailed`. Never the raw ticket key (LIST-01).
    return {
      key: summary.key,
      recipientEmail: RECIPIENT_UNKNOWN_PLACEHOLDER,
      requesterId: null,
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

  const { email: recipientEmail, requesterId } = resolveRecipientEmail(ticket);
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
    requesterId,
    subject,
    summary: truncatedSummary,
    badge,
    lastPublicCommentAt,
    hydrationFailed,
  };
}

/**
 * Computes `hasMore` from the advanced-search envelope (D-12). CONFIRMED
 * live (01-02-probe-findings.md): `pageNumber` is 0-indexed and `totalPages`
 * is always present. Falls back to a page-size heuristic only if a future
 * API change ever omits both fields.
 */
function computeHasMore(
  response: AdvancedSearchResponse,
  requestedSize: number
): boolean {
  if (
    typeof response.totalPages === "number" &&
    typeof response.pageNumber === "number"
  ) {
    return response.pageNumber + 1 < response.totalPages;
  }
  return response.content.length === requestedSize;
}

export class SideConversationsStore {
  rootStore: RootStore;
  status: ConversationsListStatus = "loading";
  rows: ConversationRowVM[] = [];
  page = 0;
  hasMore = false;
  loadingMore = false;
  error: NetworkError | HttpError | null = null;

  private generation = 0;
  private currentParentKey: string | null = null;
  private userEmailCache = new Map<number, Promise<string | null>>();

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
    this.hasMore = false;
    this.loadingMore = false;
    this.error = null;
    this.currentParentKey = parentKey;

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
        { size: PAGE_SIZE, page: 0 }
      );

      if (gen !== this.generation) return;

      const hydrated = await Promise.allSettled(
        response.content.map((row) => grispiAPI.tickets.getTicket(row.key))
      );

      if (gen !== this.generation) return;

      const summariesByKey = new Map(
        response.content.map((s) => [s.key, s] as const)
      );

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
        this.hasMore = computeHasMore(response, PAGE_SIZE);
      });

      // Silent self-heal (D-11): never flips `status`, never surfaces an
      // error — only replaces rows in place on success.
      await this.retryFailedHydrations(gen, summariesByKey);
      await this.enrichUnresolvedRecipients(gen);
    } catch (err) {
      if (gen !== this.generation) return;

      runInAction(() => {
        this.error =
          err instanceof NetworkError || err instanceof HttpError ? err : null;
        this.status = "error";
      });
    }
  }

  /**
   * Fetches and appends the next page (D-12). No-ops while already loading a
   * page, when there is no further page, or when the list isn't in "ready"
   * (rapid repeated clicks self-throttle — T-03-03). Discards its result if
   * a ticket switch bumped the generation while the fetch was in flight
   * (Pitfall #6) — `load()` already reset everything for the new ticket.
   */
  async loadMore() {
    if (this.loadingMore || !this.hasMore || this.status !== "ready") return;
    if (!this.currentParentKey) return;

    const gen = this.generation;
    const parentKey = this.currentParentKey;
    const nextPage = this.page + 1;

    this.loadingMore = true;

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
        { size: PAGE_SIZE, page: nextPage }
      );

      if (gen !== this.generation) return;

      const hydrated = await Promise.allSettled(
        response.content.map((row) => grispiAPI.tickets.getTicket(row.key))
      );

      if (gen !== this.generation) return;

      const summariesByKey = new Map(
        response.content.map((s) => [s.key, s] as const)
      );

      const newRows = hydrated.map((outcome, index) => {
        const summary = response.content[index];
        return outcome.status === "fulfilled"
          ? toRow(summary, outcome.value, false)
          : toRow(summary, null, true);
      });

      runInAction(() => {
        // Re-sort across the FULL list (existing + appended) so groups stay
        // correct across page boundaries (D-08).
        this.rows = sortConversations([...this.rows, ...newRows]);
        this.page = nextPage;
        this.hasMore = computeHasMore(response, PAGE_SIZE);
      });

      await this.retryFailedHydrations(gen, summariesByKey);
      await this.enrichUnresolvedRecipients(gen);
    } finally {
      if (gen === this.generation) {
        runInAction(() => {
          this.loadingMore = false;
        });
      }
    }
  }

  /**
   * D-11 silent self-heal: re-fetches only the rows whose `getTicket` call
   * rejected on the initial settle (naturally ≤ PAGE_SIZE, one page's worth).
   * No backoff, exactly one attempt. Never flips `status` — a repeat
   * failure just leaves the row dimmed.
   */
  private async retryFailedHydrations(
    gen: number,
    summariesByKey: Map<string, SideTicketSummary>
  ) {
    const failedKeys = this.rows
      .filter((row) => row.hydrationFailed)
      .map((row) => row.key)
      .slice(0, PAGE_SIZE);

    if (failedKeys.length === 0) return;

    const results = await Promise.allSettled(
      failedKeys.map((key) => grispiAPI.tickets.getTicket(key))
    );

    if (gen !== this.generation) return;

    runInAction(() => {
      results.forEach((outcome, index) => {
        const key = failedKeys[index];
        const summary = summariesByKey.get(key);
        if (!summary || outcome.status !== "fulfilled") return;

        const upgradedRow = toRow(summary, outcome.value, false);
        const rowIndex = this.rows.findIndex((row) => row.key === key);
        if (rowIndex !== -1) this.rows[rowIndex] = upgradedRow;
      });

      this.rows = sortConversations(this.rows);
    });
  }

  /**
   * GAP CLOSURE (Plan 01-03 orchestrator note): background `GET
   * /public/v1/users/{id}` resolution for any row still showing
   * `RECIPIENT_UNKNOWN_PLACEHOLDER` with a known `requesterId`. Silent —
   * never flips `status`; on failure the placeholder simply stays (never
   * the raw ticket key). Deduplicated per user id via `userEmailCache`.
   */
  private async enrichUnresolvedRecipients(gen: number) {
    const pendingUserIds = new Set<number>();
    for (const row of this.rows) {
      if (
        row.requesterId !== null &&
        row.recipientEmail === RECIPIENT_UNKNOWN_PLACEHOLDER
      ) {
        pendingUserIds.add(row.requesterId);
      }
    }

    if (pendingUserIds.size === 0) return;

    await Promise.all(
      Array.from(pendingUserIds).map(async (userId) => {
        const email = await this.fetchUserEmail(userId);
        if (!email || gen !== this.generation) return;

        runInAction(() => {
          this.rows.forEach((row) => {
            if (
              row.requesterId === userId &&
              row.recipientEmail === RECIPIENT_UNKNOWN_PLACEHOLDER
            ) {
              row.recipientEmail = email;
            }
          });
        });
      })
    );
  }

  private fetchUserEmail(userId: number): Promise<string | null> {
    let cached = this.userEmailCache.get(userId);
    if (!cached) {
      cached = grispiAPI.users
        .getUser(userId)
        .then((user) => user?.primaryEmail ?? null)
        .catch(() => null);
      this.userEmailCache.set(userId, cached);
    }
    return cached;
  }
}
