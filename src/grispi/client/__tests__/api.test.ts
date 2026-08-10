import { GrispiAPI } from "../api";

/**
 * WR-02 / CORE-04 — `api.ts` was the only client module with no test file at
 * all, which is itself part of what WR-02 reports. Placed in its own
 * api.test.ts (not appended to http-handler.test.ts) because the subject
 * under test is GrispiAPI, a different module with different fixture needs
 * (auth headers, a real sub-service), and this directory already follows
 * one-test-file-per-client-module (attachments.test.ts, tickets.test.ts,
 * http-handler.test.ts).
 *
 * `httpHandler` is private on GrispiAPI, so the only honest proof of
 * delegation is end-to-end: observe the URL a real sub-service call hands to
 * fetch(). Expected hosts are hardcoded literals, never looked up from the
 * shared host-map constant in environment.ts — same non-circularity rule as
 * http-handler.test.ts; this file deliberately imports nothing from
 * ../environment at all, and that absence is itself part of the guard.
 */
describe("GrispiAPI.setEnvironment -> private httpHandler delegation (CORE-04, WR-02)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("delegates setEnvironment('preprod') to the private httpHandler, observed through a real tickets.getTicket call", async () => {
    // preprod specifically, not prod: this is a NON-default environment, so
    // this single assertion goes red both when GrispiAPI.setEnvironment
    // stops delegating AND when HttpHandler.setEnvironment becomes a no-op.
    // Had this used "prod" it would pass against both mutants, since a
    // fresh GrispiAPI already sits on the prod host (see the control test
    // below).
    const api = new GrispiAPI();
    api.authentication.setToken("test-token");
    api.authentication.setTenantId("test-tenant");

    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    } as unknown as Response);

    api.setEnvironment("preprod");
    await api.tickets.getTicket("DESTEK-1");

    expect(fetchSpy.mock.calls[0][0]).toBe(
      "https://api.grispi.net/public/v1/tickets/DESTEK-1"
    );
  });

  it("control: a fresh GrispiAPI with no setEnvironment call stays on the prod host", async () => {
    // Makes the treatment test's result attributable to setEnvironment
    // rather than to some ambient default, and pins the safe-side default
    // at the composed-API level (not just at HttpHandler's).
    const api = new GrispiAPI();
    api.authentication.setToken("test-token");
    api.authentication.setTenantId("test-tenant");

    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    } as unknown as Response);

    await api.tickets.getTicket("DESTEK-1");

    expect(fetchSpy.mock.calls[0][0]).toBe(
      "https://api.grispi.com/public/v1/tickets/DESTEK-1"
    );
  });
});
