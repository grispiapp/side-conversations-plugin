import { Authentication } from "./authentication";
import { HttpHandler } from "./http-handler";

import {
  AdvancedSearchRequest,
  AdvancedSearchResponse,
  CreateTicketRequest,
  PatchTicketRequest,
  PatchTicketResponse,
  Ticket,
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
   * Creates a side-conversation ticket. Response shape is confirmed
   * live to be the same full `Ticket` object family as `getTicket` (Phase 02
   * Plan 01 Task 1 checkpoint probe; see `02-01-SUMMARY.md` "Probe
   * Findings" A1) — the caller only needs the returned `.key`. Body
   * construction (subject/requester/creator/parent-link) is the caller's
   * responsibility (Plan 04's ComposeStore); this method only sends it.
   */
  async createTicket(body: CreateTicketRequest) {
    return this.http.send<Ticket>("public/v1/tickets", {
      method: "POST",
      cache: "no-cache",
      headers: this.auth.headers,
      body: JSON.stringify(body),
    });
  }

  /**
   * Applies a probe-backed reply or status-only mutation. PATCH responses
   * are mutation-ticket objects rather than canonical GET `Ticket`s, so
   * callers should refetch with `getTicket` before replacing application
   * state.
   */
  async patchTicket(ticketKey: string, body: PatchTicketRequest) {
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
