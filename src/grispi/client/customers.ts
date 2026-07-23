import { Authentication } from "./authentication";
import { HttpHandler } from "./http-handler";

import { CustomerSearchResponse } from "@/types/grispi.type";

/**
 * `GET /public/v1/customers/search` — absent from Grispi's public OpenAPI
 * spec but CONFIRMED live (Phase 02 Plan 01 Task 1 checkpoint probe; see
 * `02-01-SUMMARY.md` "Probe Findings" A2/A3). Backs the recipient-picker
 * autocomplete (RecipientField, Plan 03) — a temsilci types a few characters
 * and this resolves matching end-users by name/email. `size` defaults to 10
 * since the panel is only ~372px wide (Open Question #3 — a larger page
 * would never fit on-screen anyway). NOTE: the live endpoint 422s when
 * `searchTerm` is under 3 characters, so callers must debounce/guard below
 * that length rather than firing a request that will always fail.
 */
export class Customers {
  constructor(
    private http: HttpHandler,
    private auth: Authentication
  ) {}

  async search(params: { searchTerm: string; size: number; page: number }) {
    const query = new URLSearchParams({
      searchTerm: params.searchTerm,
      orderBy: "fullName",
      size: String(params.size),
      page: String(params.page),
    });

    return this.http.send<CustomerSearchResponse>(
      `public/v1/customers/search?${query.toString()}`,
      {
        method: "GET",
        cache: "no-cache",
        headers: this.auth.headers,
      }
    );
  }
}
