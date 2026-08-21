import { Authentication } from "./authentication";
import { HttpHandler } from "./http-handler";

import {
  AdvancedSearchRequest,
  AdvancedSearchResponse,
  CreateTicketRequest,
  InternalNotePatchRequest,
  PatchTicketResponse,
  ReplyTicketPatchRequest,
  StatusTicketPatchRequest,
  Ticket,
  TicketFieldsPatchRequest,
} from "@/types/grispi.type";

export class Tickets {
  constructor(
    private http: HttpHandler,
    private auth: Authentication
  ) {}

  async getTicket(ticketKey: string) {
    const response = await this.http.send<Ticket>(
      `public/v1/tickets/${encodeURIComponent(ticketKey)}`,
      {
        method: "GET",
        cache: "no-cache",
        headers: this.auth.headers,
      }
    );

    return response;
  }

  /**
   * Search tickets by custom-field conditions. `advancedSearch` + `getTicket`
   * were built in Phase 1; `createTicket` was added in Phase 2 (CORE-02
   * narrowing, see RESEARCH.md Open Question #6); `patchTicket` is the
   * Phase 3 mutation boundary and getDigest remains deferred to Phase 4.
   */
  async advancedSearch(
    body: AdvancedSearchRequest,
    params: { size: number; page: number }
  ) {
    return this.http.send<AdvancedSearchResponse>(
      `public/v1/tickets/advanced-search?size=${params.size}&page=${params.page}`,
      {
        method: "POST",
        cache: "no-cache",
        headers: this.auth.headers,
        body: JSON.stringify(body),
      }
    );
  }

  /**
   * Creates a side-conversation ticket. MUST target `/v2/tickets`, never
   * `public/v1/tickets` — `public/v1` silently ignores
   * `comment.attachmentIds` (2xx returned, attachment never binds; Phase 04
   * Plan 01 checkpoint probe A2, see `04-01-SUMMARY.md` "Probe Findings" /
   * "Architecture Decision"). `replyTicket` below moves for the exact same
   * reason; `patchTicket` (status-only) deliberately does NOT move — see its
   * own doc-comment for the D-15 rationale. The caller only needs the
   * returned `.key`; body construction (subject/requester/creator/
   * parent-link/attachmentIds) is the caller's responsibility (ComposeStore),
   * this method only sends it.
   */
  async createTicket(body: CreateTicketRequest) {
    return this.http.send<Ticket>("v2/tickets", {
      method: "POST",
      cache: "no-cache",
      headers: this.auth.headers,
      body: JSON.stringify(body),
    });
  }

  /**
   * Applies a public reply mutation. MUST target `/v2/tickets/{key}`, never
   * `public/v1/tickets/{key}` — same attachment-binding reason as
   * `createTicket` above (`public/v1` silently ignores
   * `comment.attachmentIds`). Do NOT fold this back into `patchTicket`
   * below: `/v2/tickets` PATCH requires a `comment` in the body (probe
   * finding N2, `04-01-SUMMARY.md`) and returns 500 without one — fine here
   * since a reply always carries a comment, but WRONG for a status-only
   * lifecycle PATCH (see `patchTicket`'s doc-comment, D-15). PATCH responses
   * are mutation-ticket objects rather than canonical GET `Ticket`s, so
   * callers should refetch with `getTicket` before replacing application
   * state.
   */
  async replyTicket(ticketKey: string, body: ReplyTicketPatchRequest) {
    return this.http.send<PatchTicketResponse>(
      `v2/tickets/${encodeURIComponent(ticketKey)}`,
      {
        method: "PATCH",
        cache: "no-cache",
        headers: this.auth.headers,
        body: JSON.stringify(body),
      }
    );
  }

  /**
   * D-01/D-02 — appends a silent internal note (`publicVisible: false`) to
   * an already-created side ticket and re-asserts its `tp.side_conversation_
   * parent` field (D-22). Deliberately a SIBLING of `replyTicket` above —
   * never calls it, never shares its request type (`InternalNotePatchRequest`
   * narrows `publicVisible` to `false`, `ReplyTicketPatchRequest` narrows it
   * to `true`; see that type's own doc-comment, RESEARCH.md Pitfall #3).
   * Stays on `/v2/tickets`, never `public/v1/tickets/{key}` — `patchTicket`
   * below is the only method on that host, and its D-15 rationale is
   * untouched since this method never touches `ts.status`. PATCH responses
   * are mutation-ticket objects, not canonical GET `Ticket`s; callers do not
   * need to refetch off this response — the create mutation's own
   * `refreshCanonicalAfterMutation` handles that.
   */
  async addInternalNote(ticketKey: string, body: InternalNotePatchRequest) {
    return this.http.send<PatchTicketResponse>(
      `v2/tickets/${encodeURIComponent(ticketKey)}`,
      {
        method: "PATCH",
        cache: "no-cache",
        headers: this.auth.headers,
        body: JSON.stringify(body),
      }
    );
  }

  /**
   * Applies a status-only lifecycle mutation (solve/reopen). DELIBERATELY
   * stays on `public/v1/tickets/{key}`, never `/v2/tickets` — `/v2/tickets`
   * PATCH requires a `comment` in the body (probe finding N2) and returns
   * 500 without one, and adding a comment here to satisfy that would itself
   * violate Phase 3's locked decision D-15 (solve/reopen must produce NO
   * comment and send NO email). If a future "cleanup" ever tries to unify
   * this with `replyTicket` above, it CANNOT — that would silently break
   * D-15. See `04-01-SUMMARY.md` "Architecture Decision" for the full
   * write-path split rationale. PATCH responses are mutation-ticket objects
   * rather than canonical GET `Ticket`s, so callers should refetch with
   * `getTicket` before replacing application state.
   */
  async patchTicket(ticketKey: string, body: StatusTicketPatchRequest) {
    return this.http.send<PatchTicketResponse>(
      `public/v1/tickets/${encodeURIComponent(ticketKey)}`,
      {
        method: "PATCH",
        cache: "no-cache",
        headers: this.auth.headers,
        body: JSON.stringify(body),
      }
    );
  }

  /**
   * D-23 — sibling of `patchTicket` above: a generic `fields`-only write to
   * `public/v1/tickets/{key}`, comment-free by type (`TicketFieldsPatchRequest`
   * has no `comment` member). Stays on `public/v1`, never `/v2/tickets` —
   * same N2 reasoning as `patchTicket`'s own doc-comment: `/v2/tickets` PATCH
   * requires a `comment` and 500s without one, so a comment-free write is
   * only possible here. Guards against `ts.status` before sending so this
   * generic field-writer can never re-open the lifecycle hole `patchTicket`'s
   * narrowing already closed (D-15) — solve/reopen stays exclusively on
   * `patchTicket`. Its only caller today is `assertSideConversationLink`'s
   * one retry (D-23).
   */
  async patchTicketFields(ticketKey: string, body: TicketFieldsPatchRequest) {
    if (body.fields.some((field) => field.key === "ts.status")) {
      throw new Error(
        "patchTicketFields must not write ts.status — use Tickets.patchTicket for lifecycle transitions (D-15)"
      );
    }

    return this.http.send<PatchTicketResponse>(
      `public/v1/tickets/${encodeURIComponent(ticketKey)}`,
      {
        method: "PATCH",
        cache: "no-cache",
        headers: this.auth.headers,
        body: JSON.stringify(body),
      }
    );
  }
}
