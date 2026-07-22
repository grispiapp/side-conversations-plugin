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
