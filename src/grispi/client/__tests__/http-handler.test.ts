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
