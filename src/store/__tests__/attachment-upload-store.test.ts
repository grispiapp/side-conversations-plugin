import {
  AttachmentUploader,
  AttachmentUploadStore,
} from "../attachment-upload-store";
import { RootStore } from "../root-store";

import { NetworkError, HttpError } from "@/grispi/client/http-handler";
import { MAX_ATTACHMENT_BYTES } from "@/lib/attachment-validation";
import { makeTestFile } from "@/lib/attachment-test-helpers";
import { UploadFilesResponse } from "@/types/grispi.type";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Every call to the mocked uploader gets its own controllable deferred —
 * tests resolve/reject them in whatever order the scenario needs. */
function makeUploader(): {
  uploader: AttachmentUploader;
  calls: { file: File; options?: { inline?: boolean } }[];
  deferreds: Deferred<UploadFilesResponse>[];
} {
  const calls: { file: File; options?: { inline?: boolean } }[] = [];
  const deferreds: Deferred<UploadFilesResponse>[] = [];
  const uploader: AttachmentUploader = (file, options) => {
    calls.push({ file, options });
    const next = deferred<UploadFilesResponse>();
    deferreds.push(next);
    return next.promise;
  };
  return { uploader, calls, deferreds };
}

function makeUploadResponse(
  overrides: Partial<UploadFilesResponse> = {}
): UploadFilesResponse {
  return {
    id: 1,
    filename: "test.txt",
    objectKey: "key",
    objectThumbKey: "thumb-key",
    bucket: "bucket",
    mimeType: "text/plain",
    size: 100,
    userId: 4,
    objectThumbUrl: "https://usercontent.grispi.net/thumb",
    objectUrl: "https://usercontent.grispi.net/obj",
    ...overrides,
  };
}

/** Flushes the microtask queue enough times for a `.then()`/`.catch()` chain
 * followed by a `runInAction` callback to settle. */
async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

let objectUrlCounter = 0;
const createObjectURLMock = jest.fn();
const revokeObjectURLMock = jest.fn();

beforeAll(() => {
  Object.defineProperty(global.URL, "createObjectURL", {
    value: createObjectURLMock,
    writable: true,
  });
  Object.defineProperty(global.URL, "revokeObjectURL", {
    value: revokeObjectURLMock,
    writable: true,
  });
});

// react-scripts' Jest preset defaults `resetMocks: true`, which clears a
// jest.fn's implementation before every test — so the implementation MUST be
// (re)installed in `beforeEach`, not passed to `jest.fn(...)` at module scope
// (that initial implementation would already be wiped by the time any test
// body runs).
beforeEach(() => {
  objectUrlCounter = 0;
  createObjectURLMock.mockImplementation(
    (): string => `blob:mock-${++objectUrlCounter}`
  );
  revokeObjectURLMock.mockImplementation(() => undefined);
});

function makeStore(uploader: AttachmentUploader): AttachmentUploadStore {
  return new AttachmentUploadStore({} as RootStore, uploader);
}

describe("AttachmentUploadStore", () => {
  it("starts uploading every accepted file immediately, without waiting for send (D-05)", () => {
    const { uploader, calls } = makeUploader();
    const store = makeStore(uploader);
    const fileA = makeTestFile("a.txt", 10, "text/plain");
    const fileB = makeTestFile("b.txt", 20, "text/plain");

    const rejected = store.addFiles("compose", [fileA, fileB]);

    expect(rejected).toHaveLength(0);
    expect(calls).toHaveLength(2);
    const chips = store.chips("compose");
    expect(chips).toHaveLength(2);
    expect(chips.every((chip) => chip.status === "uploading")).toBe(true);
  });

  it("moves a chip to done and carries the server attachment id once its upload resolves", async () => {
    const { uploader, deferreds } = makeUploader();
    const store = makeStore(uploader);
    const file = makeTestFile("a.txt", 10, "text/plain");

    store.addFiles("compose", [file]);
    deferreds[0].resolve(makeUploadResponse({ id: 555 }));
    await flush();

    const [chip] = store.chips("compose");
    expect(chip.status).toBe("done");
    expect(chip.attachmentId).toBe(555);
  });

  it("returns rejected files from addFiles without creating chips for them, while still adding the accepted ones (D-11)", () => {
    const { uploader, calls } = makeUploader();
    const store = makeStore(uploader);
    const okFile = makeTestFile("ok.txt", 10, "text/plain");
    const tooBig = makeTestFile("too-big.bin", 11 * 1024 * 1024, "application/octet-stream");

    const rejected = store.addFiles("compose", [okFile, tooBig]);

    expect(rejected).toHaveLength(1);
    expect(rejected[0].file).toBe(tooBig);
    expect(rejected[0].reason).toBe("size");
    expect(calls).toHaveLength(1);
    expect(store.chips("compose")).toHaveLength(1);
    expect(store.chips("compose")[0].filename).toBe("ok.txt");
  });

  it("classifies a rejected upload's error kind as network for NetworkError and server otherwise (D-07)", async () => {
    const { uploader, deferreds } = makeUploader();
    const store = makeStore(uploader);
    const networkFile = makeTestFile("net.txt", 10, "text/plain");
    const serverFile = makeTestFile("srv.txt", 10, "text/plain");

    store.addFiles("compose", [networkFile]);
    store.addFiles("compose", [serverFile]);

    deferreds[0].reject(new NetworkError(new Error("offline")));
    deferreds[1].reject(new HttpError(500, null));
    await flush();

    const [networkChip, serverChip] = store.chips("compose");
    expect(networkChip.status).toBe("failed");
    expect(networkChip.errorKind).toBe("network");
    expect(serverChip.status).toBe("failed");
    expect(serverChip.errorKind).toBe("server");
  });

  it("retryChip re-uploads the SAME File and resolves to done on success (D-07)", async () => {
    const { uploader, calls, deferreds } = makeUploader();
    const store = makeStore(uploader);
    const file = makeTestFile("a.txt", 10, "text/plain");

    store.addFiles("compose", [file]);
    deferreds[0].reject(new NetworkError(new Error("offline")));
    await flush();
    expect(store.chips("compose")[0].status).toBe("failed");

    const chipId = store.chips("compose")[0].id;
    store.retryChip("compose", chipId);

    expect(calls).toHaveLength(2);
    expect(calls[1].file).toBe(file);
    expect(store.chips("compose")[0].status).toBe("uploading");
    expect(store.chips("compose")[0].errorKind).toBeUndefined();

    deferreds[1].resolve(makeUploadResponse({ id: 42 }));
    await flush();

    expect(store.chips("compose")[0].status).toBe("done");
    expect(store.chips("compose")[0].attachmentId).toBe(42);
  });

  it("isUploading is true while any chip uploads and false once all settle (D-06)", async () => {
    const { uploader, deferreds } = makeUploader();
    const store = makeStore(uploader);
    const file = makeTestFile("a.txt", 10, "text/plain");

    store.addFiles("compose", [file]);
    expect(store.isUploading("compose")).toBe(true);

    deferreds[0].resolve(makeUploadResponse());
    await flush();

    expect(store.isUploading("compose")).toBe(false);
  });

  it("removeChip drops the chip, calls no server/uploader deletion, and revokes its local preview URL (D-17)", () => {
    const { uploader, calls } = makeUploader();
    const store = makeStore(uploader);
    const imageFile = makeTestFile("pic.png", 10, "image/png");

    store.addFiles("compose", [imageFile]);
    const chipId = store.chips("compose")[0].id;
    expect(store.chips("compose")[0].previewUrl).toBeDefined();

    store.removeChip("compose", chipId);

    expect(store.chips("compose")).toHaveLength(0);
    expect(calls).toHaveLength(1); // only the original upload call — no delete call
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(1);
  });

  it("does not resurrect a chip removed while its upload is still in flight, once the late response arrives (production guard)", async () => {
    const { uploader, deferreds } = makeUploader();
    const store = makeStore(uploader);
    const file = makeTestFile("a.txt", 10, "text/plain");

    store.addFiles("compose", [file]);
    const chipId = store.chips("compose")[0].id;
    store.removeChip("compose", chipId);
    expect(store.chips("compose")).toHaveLength(0);

    deferreds[0].resolve(makeUploadResponse({ id: 999 }));
    await flush();

    expect(store.chips("compose")).toHaveLength(0);
  });

  it("keeps compose and reply as two independent buckets", () => {
    const { uploader } = makeUploader();
    const store = makeStore(uploader);
    const composeFile = makeTestFile("compose.txt", 10, "text/plain");
    const replyFile = makeTestFile("reply.txt", 10, "text/plain");

    store.addFiles("compose", [composeFile]);
    store.addFiles("reply", [replyFile]);

    expect(store.chips("compose")).toHaveLength(1);
    expect(store.chips("compose")[0].filename).toBe("compose.txt");
    expect(store.chips("reply")).toHaveLength(1);
    expect(store.chips("reply")[0].filename).toBe("reply.txt");
  });

  it("reset(surface) clears only that surface's chips and inline images, releasing preview URLs, and leaves the other surface untouched", () => {
    const { uploader } = makeUploader();
    const store = makeStore(uploader);
    const composeImage = makeTestFile("c.png", 10, "image/png");
    const replyFile = makeTestFile("r.txt", 10, "text/plain");

    store.addFiles("compose", [composeImage]);
    store.addFiles("reply", [replyFile]);
    store.registerInlineImage("compose", {
      id: 7,
      objectUrl: "https://usercontent.grispi.net/inline-7",
    });

    store.reset("compose");

    expect(store.chips("compose")).toHaveLength(0);
    expect(store.inlineImages("compose")).toHaveLength(0);
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(1);
    expect(store.chips("reply")).toHaveLength(1);
    expect(store.chips("reply")[0].filename).toBe("r.txt");
  });

  it("hasAttachments is true once a chip exists and false for an empty surface (D-18)", () => {
    const { uploader } = makeUploader();
    const store = makeStore(uploader);
    expect(store.hasAttachments("compose")).toBe(false);

    store.addFiles("compose", [makeTestFile("a.txt", 10, "text/plain")]);
    expect(store.hasAttachments("compose")).toBe(true);
    expect(store.hasAttachments("reply")).toBe(false);
  });

  it("collectAttachmentIds returns only completed chip ids — never failed or still-uploading ones", async () => {
    const { uploader, deferreds } = makeUploader();
    const store = makeStore(uploader);
    const doneFile = makeTestFile("done.txt", 10, "text/plain");
    const failedFile = makeTestFile("failed.txt", 10, "text/plain");
    const uploadingFile = makeTestFile("uploading.txt", 10, "text/plain");

    store.addFiles("compose", [doneFile, failedFile, uploadingFile]);
    deferreds[0].resolve(makeUploadResponse({ id: 101 }));
    deferreds[1].reject(new HttpError(500, null));
    // deferreds[2] intentionally left unresolved (still uploading)
    await flush();

    expect(store.collectAttachmentIds("compose", "<p>irrelevant</p>")).toEqual([
      101,
    ]);
  });

  it("collectAttachmentIds includes inline ids whose objectUrl survives in the body HTML and drops removed ones (D-16)", () => {
    const { uploader } = makeUploader();
    const store = makeStore(uploader);

    store.registerInlineImage("compose", {
      id: 10,
      objectUrl: "https://usercontent.grispi.net/inline-10",
    });
    store.registerInlineImage("compose", {
      id: 11,
      objectUrl: "https://usercontent.grispi.net/inline-11",
    });

    const bodyHtml =
      '<p>merhaba</p><img src="https://usercontent.grispi.net/inline-10">';
    expect(store.collectAttachmentIds("compose", bodyHtml)).toEqual([10]);
  });

  it("collectAttachmentIds puts inline ids before chip ids in the merged output", async () => {
    const { uploader, deferreds } = makeUploader();
    const store = makeStore(uploader);

    store.registerInlineImage("compose", {
      id: 10,
      objectUrl: "https://usercontent.grispi.net/inline-10",
    });
    store.addFiles("compose", [makeTestFile("done.txt", 10, "text/plain")]);
    deferreds[0].resolve(makeUploadResponse({ id: 200 }));
    await flush();

    const bodyHtml = '<img src="https://usercontent.grispi.net/inline-10">';
    expect(store.collectAttachmentIds("compose", bodyHtml)).toEqual([10, 200]);
  });
});

describe("AttachmentUploadStore.uploadInlineImage (COMP-08, Plan 08 — first caller of registerInlineImage)", () => {
  it("calls the injected uploader exactly once, with the file and inline:true (D-14)", () => {
    const { uploader, calls } = makeUploader();
    const store = makeStore(uploader);
    const image = makeTestFile("shot.png", 10, "image/png");

    void store.uploadInlineImage("compose", image);

    expect(calls).toHaveLength(1);
    expect(calls[0].file).toBe(image);
    expect(calls[0].options).toEqual({ inline: true });
  });

  it("registers the resolved record (server id + objectUrl) into the surface's inline bucket, readable via inlineImages(surface)", async () => {
    const { uploader, deferreds } = makeUploader();
    const store = makeStore(uploader);
    const image = makeTestFile("shot.png", 10, "image/png");

    const promise = store.uploadInlineImage("compose", image);
    deferreds[0].resolve(
      makeUploadResponse({
        id: 77,
        objectUrl: "https://usercontent.grispi.net/inline-77",
      })
    );
    const resolved = await promise;

    expect(resolved).toEqual({
      id: 77,
      objectUrl: "https://usercontent.grispi.net/inline-77",
    });
    expect(store.inlineImages("compose")).toEqual([
      { id: 77, objectUrl: "https://usercontent.grispi.net/inline-77" },
    ]);
  });

  it("never adds the inline record to chips(surface) — inline images never enter the chip list (D-15 regression gate)", async () => {
    const { uploader, deferreds } = makeUploader();
    const store = makeStore(uploader);
    const image = makeTestFile("shot.png", 10, "image/png");

    const promise = store.uploadInlineImage("compose", image);
    deferreds[0].resolve(makeUploadResponse({ id: 1 }));
    await promise;

    expect(store.chips("compose")).toHaveLength(0);
  });

  it("keeps compose/reply inline buckets independent — an image uploaded on compose never appears in reply's bucket", async () => {
    const { uploader, deferreds } = makeUploader();
    const store = makeStore(uploader);
    const image = makeTestFile("shot.png", 10, "image/png");

    const promise = store.uploadInlineImage("compose", image);
    deferreds[0].resolve(makeUploadResponse({ id: 1 }));
    await promise;

    expect(store.inlineImages("compose")).toHaveLength(1);
    expect(store.inlineImages("reply")).toHaveLength(0);
  });

  it("rejects and leaves the inline bucket untouched when the upload itself fails", async () => {
    const { uploader, deferreds } = makeUploader();
    const store = makeStore(uploader);
    const image = makeTestFile("shot.png", 10, "image/png");

    const promise = store.uploadInlineImage("compose", image);
    deferreds[0].reject(new NetworkError(new Error("offline")));

    await expect(promise).rejects.toBeInstanceOf(NetworkError);
    expect(store.inlineImages("compose")).toHaveLength(0);
  });

  it("rejects without ever calling the uploader when the file exceeds the D-08 per-file size cap", async () => {
    const { uploader, calls } = makeUploader();
    const store = makeStore(uploader);
    const oversized = makeTestFile(
      "huge.png",
      MAX_ATTACHMENT_BYTES + 1,
      "image/png"
    );

    await expect(
      store.uploadInlineImage("compose", oversized)
    ).rejects.toThrow();
    expect(calls).toHaveLength(0);
    expect(store.inlineImages("compose")).toHaveLength(0);
  });

  it("isUploading(surface) is true while the inline upload is in flight and false once it resolves — even with an empty chip list (D-06)", async () => {
    const { uploader, deferreds } = makeUploader();
    const store = makeStore(uploader);
    const image = makeTestFile("shot.png", 10, "image/png");

    const promise = store.uploadInlineImage("compose", image);
    expect(store.isUploading("compose")).toBe(true);
    expect(store.chips("compose")).toHaveLength(0);

    deferreds[0].resolve(makeUploadResponse({ id: 1 }));
    await promise;

    expect(store.isUploading("compose")).toBe(false);
  });

  it("isUploading(surface) returns to false after a failed inline upload — the in-flight counter never leaks", async () => {
    const { uploader, deferreds } = makeUploader();
    const store = makeStore(uploader);
    const image = makeTestFile("shot.png", 10, "image/png");

    const promise = store.uploadInlineImage("compose", image);
    deferreds[0].reject(new HttpError(500, null));
    await promise.catch(() => undefined);

    expect(store.isUploading("compose")).toBe(false);
  });

  it("hasAttachments(surface) is true once an inline record exists, even with zero chips (D-18)", async () => {
    const { uploader, deferreds } = makeUploader();
    const store = makeStore(uploader);
    const image = makeTestFile("shot.png", 10, "image/png");
    expect(store.hasAttachments("compose")).toBe(false);

    const promise = store.uploadInlineImage("compose", image);
    deferreds[0].resolve(makeUploadResponse({ id: 1 }));
    await promise;

    expect(store.hasAttachments("compose")).toBe(true);
    expect(store.hasAttachments("reply")).toBe(false);
  });

  it("collectAttachmentIds carries a real inline upload's id when its objectUrl survives in the final body, and drops it once the image is deleted from the body (D-16 end-to-end, via a real upload)", async () => {
    const { uploader, deferreds } = makeUploader();
    const store = makeStore(uploader);
    const image = makeTestFile("shot.png", 10, "image/png");

    const promise = store.uploadInlineImage("compose", image);
    deferreds[0].resolve(
      makeUploadResponse({
        id: 321,
        objectUrl: "https://usercontent.grispi.net/inline-321",
      })
    );
    await promise;

    const bodyWithImage =
      '<p>bkz ekran görüntüsü</p><img src="https://usercontent.grispi.net/inline-321">';
    expect(store.collectAttachmentIds("compose", bodyWithImage)).toEqual([
      321,
    ]);

    // Agent deletes the image from the editor before sending — the final
    // body HTML no longer contains the objectUrl.
    const bodyWithoutImage = "<p>bkz ekran görüntüsü</p>";
    expect(store.collectAttachmentIds("compose", bodyWithoutImage)).toEqual(
      []
    );
  });

  it("reset(surface) empties the inline bucket and clears the in-flight inline counter", async () => {
    const { uploader, deferreds } = makeUploader();
    const store = makeStore(uploader);
    const image = makeTestFile("shot.png", 10, "image/png");

    const promise = store.uploadInlineImage("compose", image);
    deferreds[0].resolve(makeUploadResponse({ id: 1 }));
    await promise;
    expect(store.inlineImages("compose")).toHaveLength(1);

    store.reset("compose");

    expect(store.inlineImages("compose")).toHaveLength(0);
    expect(store.isUploading("compose")).toBe(false);
    expect(store.hasAttachments("compose")).toBe(false);
  });
});
