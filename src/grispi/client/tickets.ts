import { Authentication } from "./authentication";
import { HttpHandler } from "./http-handler";

import {
  AdvancedSearchRequest,
  AdvancedSearchResponse,
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
   * Search tickets by custom-field conditions. Only `advancedSearch` +
   * `getTicket` are built in Phase 1 — createTicket/patchTicket/
   * searchCustomers/getDigest belong to Phases 2-4 (CORE-02 narrowing, see
   * RESEARCH.md Open Question #6).
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
}
