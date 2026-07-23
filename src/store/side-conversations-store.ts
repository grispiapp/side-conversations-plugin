import { makeAutoObservable, runInAction } from "mobx";

import { grispiAPI } from "@/grispi/client/api";
import { HttpError, NetworkError } from "@/grispi/client/http-handler";
import { SIDE_CONVERSATION_PARENT_FIELD_KEY } from "@/lib/side-conversation";
import { SideTicketSummary, Ticket } from "@/types/grispi.type";

import { RootStore } from "./root-store";

export type ConversationsListStatus = "loading" | "ready" | "empty" | "error";

export interface ConversationRowVM {
  key: string;
  recipientEmail: string;
  subject: string;
  summary: string;
  lastPublicCommentAt: number | null;
  hydrationFailed: boolean;
}

const SUMMARY_MAX_LENGTH = 140;

/**
 * Maps a hydrated `Ticket` (or a hydration failure) into a row view model.
 *
 * The recipient/subject lookups below are the SINGLE centralized place these
 * unverified API-shape assumptions live (RESEARCH.md Open Question #3):
 * neither `ts.requester` nor `ts.subject` as `fieldMap` keys have been
 * confirmed against a live payload yet. Plan 02's first task is a live probe
 * that corrects these if wrong — only this function needs to change.
 */
function toRow(
  summary: SideTicketSummary,
  ticket: Ticket | null,
  hydrationFailed: boolean
): ConversationRowVM {
  if (!ticket) {
    return {
      key: summary.key,
      recipientEmail: summary.key,
      subject: summary.key,
      summary: "",
      lastPublicCommentAt: null,
      hydrationFailed: true,
    };
  }

  const lastPublicComment = (ticket.comments ?? [])
    .filter((comment) => comment.publicVisible)
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  const recipientEmail =
    ticket.fieldMap?.["ts.requester"]?.userFriendlyValue ||
    (ticket as unknown as { requester?: { email?: string } }).requester
      ?.email ||
    summary.key;

  const subject = ticket.fieldMap?.["ts.subject"]?.userFriendlyValue || summary.key;

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
    lastPublicCommentAt: lastPublicComment?.createdAt ?? null,
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

      runInAction(() => {
        this.rows = rows;
        this.status = rows.length ? "ready" : "empty";
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
