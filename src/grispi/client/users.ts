import { Authentication } from "./authentication";
import { HttpHandler } from "./http-handler";

import { GrispiUserProfile } from "@/types/grispi.type";

/**
 * `GET /public/v1/users/{id}` — absent from Grispi's public OpenAPI spec but
 * CONFIRMED working live (Plan 01-03 gap-closure probe, see
 * `.planning/phases/01-.../01-02-probe-findings.md` "EK BULGULAR" #2). Used
 * only as a fallback recipient-email resolution path when a side ticket's
 * requester has not yet authored a comment on it (agent-only threads) —
 * LIST-01 requires the recipient ("alıcı") to always be shown, never the
 * raw ticket key.
 */
export class Users {
  constructor(
    private http: HttpHandler,
    private auth: Authentication
  ) {}

  async getUser(userId: number | string) {
    return this.http.send<GrispiUserProfile>(
      `public/v1/users/${encodeURIComponent(String(userId))}`,
      {
        method: "GET",
        cache: "no-cache",
        headers: this.auth.headers,
      }
    );
  }
}
