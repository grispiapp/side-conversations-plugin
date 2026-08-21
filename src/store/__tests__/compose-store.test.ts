import { AttachmentUploadStore } from "../attachment-upload-store";
import { RootStore } from "../root-store";

import { makeTestFile } from "@/lib/attachment-test-helpers";

/** A chip is added synchronously by `addFiles` regardless of upload
 * outcome — a never-resolving uploader is enough to exercise
 * `hasAttachments`/`reset` without needing the upload to ever settle. */
function neverResolvingUploader() {
  return () => new Promise<never>(() => {});
}

describe("ComposeStore mutation-envelope seam", () => {
  let root: RootStore;

  beforeEach(() => {
    root = new RootStore();
  });

  it("keeps the pinned parent and returns one create envelope after the microtask-safe submit seam", async () => {
    root.compose.initSubject("[PARENT-OLD] Konu", "PARENT-OLD");
    root.compose.selectFreeEmail("vendor@example.test");
    root.compose.setMessage("<p>Merhaba</p>");

    const first = root.compose.submit(
      "tenant-1",
      "agent@example.test",
      "PARENT-NEW",
      12
    );
    const second = root.compose.submit(
      "tenant-1",
      "agent@example.test",
      "PARENT-NEW",
      12
    );

    expect(root.compose.submitting).toBe(true);
    await expect(second).resolves.toBeNull();
    const envelope = await first;
    expect(envelope).toMatchObject({
      kind: "create",
      tenantId: "tenant-1",
      parentKey: "PARENT-OLD",
      sessionKey: 12,
      request: {
        fields: expect.arrayContaining([
          {
            key: "tp.side_conversation_parent",
            value: "PARENT-OLD",
          },
        ]),
      },
    });
    expect(
      root.activeConversation.getRetryEnvelope(envelope!.clientMessageId)
    ).toBe(envelope);
    expect(root.compose.isDirty).toBe(false);
  });

  it("returns null without creating local state when required trusted or form inputs are absent", async () => {
    root.compose.selectFreeEmail("vendor@example.test");
    root.compose.setMessage("<p>Merhaba</p>");

    await expect(
      root.compose.submit(null, "agent@example.test", "PARENT-1", 1)
    ).resolves.toBeNull();
    await expect(
      root.compose.submit("tenant-1", null, "PARENT-1", 1)
    ).resolves.toBeNull();
    expect(root.activeConversation.getOverlayMessages(1, null)).toEqual([]);
    expect(root.compose.submitting).toBe(false);
  });

  it("does not select a customer without a deliverable email address", () => {
    root.compose.selectRecipient({
      id: 1,
      name: "Davut",
      email: null,
    });

    expect(root.compose.recipientEmail).toBe("");
    expect(root.compose.recipientLabel).toBe("");
  });

  it("sanitizes the final stored draft once before freezing both create request and overlay", async () => {
    root.compose.initSubject("[PARENT-1] Konu", "PARENT-1");
    root.compose.selectFreeEmail("vendor@example.test");
    root.compose.setMessage(
      '<p onclick="steal()">Merhaba <a href="javascript:steal()">link</a></p><svg><script>steal()</script></svg>'
    );

    const envelope = await root.compose.submit(
      "tenant-1",
      "agent@example.test",
      "PARENT-1",
      4
    );

    expect(envelope?.request.comment.body).toBe("<p>Merhaba <a>link</a></p>");
    expect(root.activeConversation.getOverlayMessages(4, null)[0].body).toBe(
      envelope?.request.comment.body
    );
    expect(envelope?.request.comment.body).not.toMatch(
      /onclick|javascript:|script|svg/i
    );
  });

  it("detects recipient searches and cleared prefills but ignores visually empty rich HTML", () => {
    root.compose.initSubject("[PARENT-1] Konu", "PARENT-1");
    expect(root.compose.isDirty).toBe(false);

    root.compose.setMessage("<p><br></p>");
    expect(root.compose.isDirty).toBe(false);

    root.compose.setQuery("Davut");
    expect(root.compose.isDirty).toBe(true);

    root.compose.setQuery("");
    root.compose.setSubject("");
    expect(root.compose.isDirty).toBe(true);
  });
});

describe("ComposeStore attachment-id send-binding (Phase 04 Plan 06)", () => {
  let root: RootStore;

  beforeEach(() => {
    root = new RootStore();
  });

  it("carries the caller-supplied attachment ids into the create request body", async () => {
    root.compose.initSubject("[PARENT-1] Konu", "PARENT-1");
    root.compose.selectFreeEmail("vendor@example.test");
    root.compose.setMessage("<p>Fatura ekte</p>");

    const envelope = await root.compose.submit(
      "tenant-1",
      "agent@example.test",
      "PARENT-1",
      1,
      [630, 631]
    );

    expect(envelope?.request.comment.attachmentIds).toEqual([630, 631]);
  });

  it("omits attachmentIds entirely (never []) when no ids are given", async () => {
    root.compose.initSubject("[PARENT-1] Konu", "PARENT-1");
    root.compose.selectFreeEmail("vendor@example.test");
    root.compose.setMessage("<p>Ek yok</p>");

    const withoutParam = await root.compose.submit(
      "tenant-1",
      "agent@example.test",
      "PARENT-1",
      1
    );
    expect(withoutParam?.request.comment).not.toHaveProperty("attachmentIds");

    root.compose.initSubject("[PARENT-1] Konu", "PARENT-1");
    root.compose.selectFreeEmail("vendor@example.test");
    root.compose.setMessage("<p>Ek yok</p>");
    const withEmptyArray = await root.compose.submit(
      "tenant-1",
      "agent@example.test",
      "PARENT-1",
      2,
      []
    );
    expect(withEmptyArray?.request.comment).not.toHaveProperty(
      "attachmentIds"
    );
  });

  it("still rejects a submit with an empty message even when attachment ids are given (D-03)", async () => {
    root.compose.initSubject("[PARENT-1] Konu", "PARENT-1");
    root.compose.selectFreeEmail("vendor@example.test");
    // No setMessage call — message stays "".

    const envelope = await root.compose.submit(
      "tenant-1",
      "agent@example.test",
      "PARENT-1",
      1,
      [630]
    );

    expect(envelope).toBeNull();
    expect(root.activeConversation.getOverlayMessages(1, null)).toEqual([]);
  });

  it("counts a non-empty compose attachment bucket as dirty even with no other input (D-18)", () => {
    root.attachmentUpload = new AttachmentUploadStore(
      root,
      neverResolvingUploader()
    );
    expect(root.compose.isDirty).toBe(false);

    root.attachmentUpload.addFiles("compose", [
      makeTestFile("kanit.txt", 10, "text/plain"),
    ]);

    expect(root.compose.isDirty).toBe(true);
  });

  it("stays clean when nothing is entered and the compose attachment bucket is empty (regression)", () => {
    root.attachmentUpload = new AttachmentUploadStore(
      root,
      neverResolvingUploader()
    );
    expect(root.compose.isDirty).toBe(false);
    expect(root.attachmentUpload.hasAttachments("compose")).toBe(false);
  });

  it("clears the compose attachment bucket on reset", () => {
    root.attachmentUpload = new AttachmentUploadStore(
      root,
      neverResolvingUploader()
    );
    root.attachmentUpload.addFiles("compose", [
      makeTestFile("kanit.txt", 10, "text/plain"),
    ]);
    expect(root.attachmentUpload.hasAttachments("compose")).toBe(true);

    root.compose.reset();

    expect(root.attachmentUpload.hasAttachments("compose")).toBe(false);
    expect(root.attachmentUpload.chips("compose")).toEqual([]);
  });

  it("clears the compose attachment bucket as part of a successful submit's internal reset", async () => {
    root.attachmentUpload = new AttachmentUploadStore(
      root,
      neverResolvingUploader()
    );
    root.attachmentUpload.addFiles("compose", [
      makeTestFile("kanit.txt", 10, "text/plain"),
    ]);
    root.compose.initSubject("[PARENT-1] Konu", "PARENT-1");
    root.compose.selectFreeEmail("vendor@example.test");
    root.compose.setMessage("<p>Fatura ekte</p>");

    const envelope = await root.compose.submit(
      "tenant-1",
      "agent@example.test",
      "PARENT-1",
      1,
      [630]
    );

    expect(envelope).not.toBeNull();
    expect(root.attachmentUpload.hasAttachments("compose")).toBe(false);
    // The already-frozen envelope keeps its own bound ids regardless.
    expect(envelope?.request.comment.attachmentIds).toEqual([630]);
  });
});
