import { RootStore } from "../root-store";

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
            key: "tu.side_conversation_parent",
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
});
