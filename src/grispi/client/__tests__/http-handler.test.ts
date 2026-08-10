import { DEFAULT_ENVIRONMENT, GRISPI_BASE_URLS } from "../environment";
import { HttpError, HttpHandler, NetworkError } from "../http-handler";

describe("HttpHandler.send", () => {
  let handler: HttpHandler;

  beforeEach(() => {
    handler = new HttpHandler();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("resolves the parsed JSON body when the response is ok", async () => {
    const payload = { key: "DESTEK-1" };
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(payload),
    } as unknown as Response);

    const result = await handler.send("public/v1/tickets/DESTEK-1", {
      method: "GET",
    });

    expect(result).toEqual(payload);
  });

  it("throws HttpError with the response status when the response is not ok", async () => {
    const errorBody = { message: "not found" };
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve(errorBody),
    } as unknown as Response);

    let thrown: unknown;
    try {
      await handler.send("public/v1/tickets/DESTEK-1", { method: "GET" });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(HttpError);
    expect((thrown as HttpError).status).toBe(404);
    expect((thrown as HttpError).body).toEqual(errorBody);
  });

  it("throws NetworkError with the cause when fetch rejects", async () => {
    const cause = new TypeError("Failed to fetch");
    jest.spyOn(global, "fetch").mockRejectedValue(cause);

    let thrown: unknown;
    try {
      await handler.send("public/v1/tickets/DESTEK-1", { method: "GET" });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(NetworkError);
    expect((thrown as NetworkError).cause).toBe(cause);
  });
});

describe("HttpHandler.sendMultipart", () => {
  let handler: HttpHandler;

  beforeEach(() => {
    handler = new HttpHandler();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("omits Content-Type entirely so the browser sets its own multipart boundary (regression guard)", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve([{ id: 1, objectUrl: "https://x/y.png" }]),
    } as unknown as Response);

    const formData = new FormData();
    await handler.sendMultipart("attachments/upload", formData, {
      tenantId: "t",
      Authorization: "Bearer x",
    });

    const [, options] = fetchSpy.mock.calls[0];
    expect(Object.keys(options?.headers ?? {})).not.toContain("Content-Type");
  });

  it("sends only the caller-supplied extra headers — never the class's default JSON headers", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve([{ id: 1, objectUrl: "https://x/y.png" }]),
    } as unknown as Response);

    const formData = new FormData();
    await handler.sendMultipart("attachments/upload", formData, {
      tenantId: "t",
      Authorization: "Bearer x",
    });

    const [, options] = fetchSpy.mock.calls[0];
    expect(options?.headers).toEqual({ tenantId: "t", Authorization: "Bearer x" });
  });

  it("POSTs with cache: no-cache and passes the FormData instance through as body unchanged", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve([{ id: 1, objectUrl: "https://x/y.png" }]),
    } as unknown as Response);

    const formData = new FormData();
    await handler.sendMultipart("attachments/upload", formData, {});

    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe(
      `${GRISPI_BASE_URLS[DEFAULT_ENVIRONMENT]}/attachments/upload`
    );
    expect(options?.method).toBe("POST");
    expect(options?.cache).toBe("no-cache");
    expect(options?.body).toBe(formData);
  });

  it("resolves the parsed JSON body when the response is ok", async () => {
    const payload = [{ id: 42, objectUrl: "https://x/y.png" }];
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve(payload),
    } as unknown as Response);

    const result = await handler.sendMultipart(
      "attachments/upload",
      new FormData(),
      {}
    );

    expect(result).toEqual(payload);
  });

  it("throws NetworkError with the cause when fetch rejects", async () => {
    const cause = new TypeError("Failed to fetch");
    jest.spyOn(global, "fetch").mockRejectedValue(cause);

    let thrown: unknown;
    try {
      await handler.sendMultipart("attachments/upload", new FormData(), {});
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(NetworkError);
    expect((thrown as NetworkError).cause).toBe(cause);
  });

  it("throws HttpError with the parsed error body when the response is not ok", async () => {
    const errorBody = { message: "too large" };
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 413,
      json: () => Promise.resolve(errorBody),
    } as unknown as Response);

    let thrown: unknown;
    try {
      await handler.sendMultipart("attachments/upload", new FormData(), {});
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(HttpError);
    expect((thrown as HttpError).status).toBe(413);
    expect((thrown as HttpError).body).toEqual(errorBody);
  });

  it("throws HttpError with a null body when the error response is not valid JSON", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("invalid json")),
    } as unknown as Response);

    let thrown: unknown;
    try {
      await handler.sendMultipart("attachments/upload", new FormData(), {});
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(HttpError);
    expect((thrown as HttpError).status).toBe(500);
    expect((thrown as HttpError).body).toBeNull();
  });
});

/**
 * WR-02 / CORE-04 — the terminal link of the environment-routing chain
 * (environment key -> `baseUrl` mutation -> actual `fetch` host) had no
 * behavioral test anywhere in the repo. Every expected host below is a
 * HARDCODED LITERAL, never `GRISPI_BASE_URLS[env]` — looking the expectation
 * up from the same constant the implementation reads would be circular, and
 * a swapped constant (e.g. `prod_tr` silently pointed at the `.com` host)
 * would sail straight through such an assertion. Duplication here is the
 * point: these three host strings are pinned as literals nowhere else in the
 * repo.
 */
const ENVIRONMENT_HOSTS = [
  ["preprod", "https://api.grispi.net"],
  ["prod", "https://api.grispi.com"],
  ["prod_tr", "https://api.grispi.com.tr"],
] as const;

describe("HttpHandler.setEnvironment -> fetch host (CORE-04 terminal link, WR-02)", () => {
  let handler: HttpHandler;

  beforeEach(() => {
    handler = new HttpHandler();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("a fresh handler's baseUrl is already the literal prod host, before setEnvironment is ever called", () => {
    // This is the single most important fact for interpreting the `prod`
    // rows below: a fresh HttpHandler is already on the prod host, so a
    // standalone `setEnvironment("prod")` assertion alone would pass even
    // against a completely no-op setEnvironment. It also is the only place
    // in the repo that pins the default host to a literal instead of the
    // GRISPI_BASE_URLS[DEFAULT_ENVIRONMENT] lookup.
    expect(handler.baseUrl).toBe("https://api.grispi.com");
  });

  it.each(ENVIRONMENT_HOSTS)(
    "send() fetches against the %s host after setEnvironment(%s)",
    async (env, host) => {
      const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      } as unknown as Response);

      handler.setEnvironment(env);
      await handler.send("public/v1/tickets/DESTEK-1", { method: "GET" });

      expect(fetchSpy.mock.calls[0][0]).toBe(
        `${host}/public/v1/tickets/DESTEK-1`
      );
    }
  );

  it.each(ENVIRONMENT_HOSTS)(
    "sendMultipart() fetches against the %s host after setEnvironment(%s) — independent read site from send()",
    async (env, host) => {
      // Not redundant with the send() rows above: sendMultipart() reads
      // this.baseUrl through its OWN separate template literal, so a
      // regression could break one path and leave the other intact.
      const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve([]),
      } as unknown as Response);

      handler.setEnvironment(env);
      await handler.sendMultipart("attachments/upload", new FormData(), {});

      expect(fetchSpy.mock.calls[0][0]).toBe(`${host}/attachments/upload`);
    }
  );

  it("switch-back: setEnvironment(prod) then setEnvironment(preprod) ends on the preprod host — the mutation killer", async () => {
    // THE test that goes red against an emptied setEnvironment body. A
    // single setEnvironment("prod") assertion cannot do that job, because a
    // fresh handler is already on prod (see the control test above) — that
    // row proves nothing on its own. This one requires the handler to
    // actually travel from prod to preprod.
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    } as unknown as Response);

    handler.setEnvironment("prod");
    handler.setEnvironment("preprod");
    await handler.send("public/v1/tickets/DESTEK-1", { method: "GET" });

    expect(fetchSpy.mock.calls[0][0]).toBe(
      "https://api.grispi.net/public/v1/tickets/DESTEK-1"
    );
  });

  it("switch-back: setEnvironment(preprod) then setEnvironment(prod) ends on the prod host", async () => {
    // Proves the `prod` branch of the lookup is genuinely consumed — the
    // handler had to travel back from a non-default host, which the
    // standalone `prod` row cannot show. This direction alone does NOT kill
    // the no-op mutant on its own (a no-op handler never leaves prod, so it
    // would "pass" this assertion for the wrong reason) — that is the
    // previous test's job. Neither test may be deleted as "redundant" with
    // the other; each proves something the other cannot.
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    } as unknown as Response);

    handler.setEnvironment("preprod");
    handler.setEnvironment("prod");
    await handler.send("public/v1/tickets/DESTEK-1", { method: "GET" });

    expect(fetchSpy.mock.calls[0][0]).toBe(
      "https://api.grispi.com/public/v1/tickets/DESTEK-1"
    );
  });
});
