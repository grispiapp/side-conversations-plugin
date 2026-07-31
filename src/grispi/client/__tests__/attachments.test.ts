import { makeTestFile } from "@/lib/attachment-test-helpers";

import { Attachments } from "../attachments";
import { Authentication } from "../authentication";
import { HttpError, HttpHandler } from "../http-handler";

describe("Attachments.upload", () => {
  let http: HttpHandler;
  let auth: Authentication;
  let attachments: Attachments;

  beforeEach(() => {
    http = new HttpHandler();
    auth = new Authentication(http);
    auth.setTenantId("gsocial-test");
    auth.setToken("dev-token");
    attachments = new Attachments(http, auth);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("calls the probe-confirmed root upload path (no public/v1 prefix)", async () => {
    const sendMultipartSpy = jest
      .spyOn(http, "sendMultipart")
      .mockResolvedValue([
        { id: 1, filename: "a.txt", objectUrl: "https://x/a.txt" },
      ]);

    const file = makeTestFile("a.txt", 5, "text/plain");
    await attachments.upload(file);

    expect(sendMultipartSpy.mock.calls[0][0]).toBe("attachments/upload");
  });

  it("appends ?inline=true to the path when options.inline is true", async () => {
    const sendMultipartSpy = jest
      .spyOn(http, "sendMultipart")
      .mockResolvedValue([
        { id: 2, filename: "b.png", objectUrl: "https://x/b.png", inline: true },
      ]);

    const file = makeTestFile("b.png", 5, "image/png");
    await attachments.upload(file, { inline: true });

    expect(sendMultipartSpy.mock.calls[0][0]).toBe(
      "attachments/upload?inline=true"
    );
  });

  it("does not append an inline query suffix when options.inline is false/omitted", async () => {
    const sendMultipartSpy = jest
      .spyOn(http, "sendMultipart")
      .mockResolvedValue([
        { id: 3, filename: "c.txt", objectUrl: "https://x/c.txt" },
      ]);

    const file = makeTestFile("c.txt", 5, "text/plain");
    await attachments.upload(file);
    await attachments.upload(file, { inline: false });

    expect(sendMultipartSpy.mock.calls[0][0]).toBe("attachments/upload");
    expect(sendMultipartSpy.mock.calls[1][0]).toBe("attachments/upload");
  });

  it("appends the file under the 'files' (plural) FormData field name", async () => {
    const sendMultipartSpy = jest
      .spyOn(http, "sendMultipart")
      .mockResolvedValue([
        { id: 4, filename: "d.txt", objectUrl: "https://x/d.txt" },
      ]);

    const file = makeTestFile("d.txt", 5, "text/plain");
    await attachments.upload(file);

    const formData = sendMultipartSpy.mock.calls[0][1] as FormData;
    expect(formData.get("files")).toBe(file);
  });

  it("passes Authentication.headers as the third argument to sendMultipart", async () => {
    const sendMultipartSpy = jest
      .spyOn(http, "sendMultipart")
      .mockResolvedValue([
        { id: 5, filename: "e.txt", objectUrl: "https://x/e.txt" },
      ]);

    const file = makeTestFile("e.txt", 5, "text/plain");
    await attachments.upload(file);

    expect(sendMultipartSpy.mock.calls[0][2]).toBe(auth.headers);
  });

  it("returns the first element of the (always-array) upload response", async () => {
    const uploaded = { id: 6, filename: "f.txt", objectUrl: "https://x/f.txt" };
    jest.spyOn(http, "sendMultipart").mockResolvedValue([uploaded]);

    const file = makeTestFile("f.txt", 5, "text/plain");
    const result = await attachments.upload(file);

    expect(result).toEqual(uploaded);
  });

  it("throws HttpError when the response array is empty", async () => {
    jest.spyOn(http, "sendMultipart").mockResolvedValue([]);

    const file = makeTestFile("g.txt", 5, "text/plain");

    let thrown: unknown;
    try {
      await attachments.upload(file);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(HttpError);
  });
});
