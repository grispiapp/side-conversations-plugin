import {
  ActiveConversationStore,
  MessageVM,
  MutationEnvelope,
} from "../active-conversation-store";
import { RootStore } from "../root-store";

import {
  CreateTicketRequest,
  ReplyTicketPatchRequest,
} from "@/types/grispi.type";

function createRequest(body = "<p>Merhaba</p>"): CreateTicketRequest {
  return {
    comment: {
      body,
      publicVisible: true,
      creator: [{ key: "us.email", value: "agent@example.test" }],
    },
    fields: [
      { key: "ts.subject", value: "[PARENT-1] Konu" },
      { key: "ts.requester", value: ":vendor@example.test" },
      { key: "tu.side_conversation_parent", value: "PARENT-1" },
    ],
  };
}

function canonical(
  id: number,
  body: string,
  createdAt: number,
  overrides: Partial<MessageVM> = {}
): MessageVM {
  return {
    id: `comment-${id}`,
    direction: "own",
    body,
    status: "sent",
    createdAt,
    senderEmail: "agent@example.test",
    internal: false,
    ...overrides,
  };
}

function startCreate(
  store: ActiveConversationStore,
  sessionKey = 1
): MutationEnvelope {
  return store.startNew({
    tenantId: "tenant-1",
    parentKey: "PARENT-1",
    sessionKey,
    recipientLabel: "Vendor <vendor@example.test>",
    subject: "[PARENT-1] Konu",
    body: "<p>Merhaba</p>",
    request: createRequest(),
  });
}

describe("ActiveConversationStore immutable envelope ownership", () => {
  let store: ActiveConversationStore;

  beforeEach(() => {
    store = new ActiveConversationStore({} as RootStore);
    jest.spyOn(Date, "now").mockReturnValue(10_000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("builds one recursively frozen create envelope and seeds its pending overlay", () => {
    const request = createRequest();
    const envelope = store.startNew({
      tenantId: "tenant-1",
      parentKey: "PARENT-1",
      sessionKey: 7,
      recipientLabel: "Vendor",
      subject: "Konu",
      body: "<p>Merhaba</p>",
      request,
    });

    expect(envelope).toMatchObject({
      kind: "create",
      tenantId: "tenant-1",
      parentKey: "PARENT-1",
      sessionKey: 7,
      startedAt: 10_000,
      request,
    });
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope.request)).toBe(true);
    expect(Object.isFrozen(envelope.request.comment)).toBe(true);
    expect(Object.isFrozen(envelope.request.comment.creator)).toBe(true);
    expect(Object.isFrozen(envelope.request.fields)).toBe(true);
    expect(store.getOverlayMessages(7, null)).toEqual([
      expect.objectContaining({
        id: envelope.clientMessageId,
        body: "<p>Merhaba</p>",
        status: "pending",
      }),
    ]);
    expect(store.getRetryEnvelope(envelope.clientMessageId)).toBe(envelope);
  });

  it("retains the exact reply envelope and request identity across failure and retry", () => {
    store.activateSession(3, "SIDE-1");
    store.setDraftHtml('<p onclick="bad()">Yeni</p><script>x()</script>');
    const envelope = store.sendReply({
      tenantId: "tenant-1",
      parentKey: "PARENT-1",
      sideKey: "SIDE-1",
      sessionKey: 3,
      agentEmail: "agent@example.test",
      canonicalMessages: [
        canonical(1, "<p>Önceki</p>", 1_000, {
          direction: "incoming",
          senderEmail: "vendor@example.test",
        }),
        canonical(2, "<p>Gizli</p>", 2_000, { internal: true }),
      ],
    });

    expect(envelope?.kind).toBe("reply");
    const request = envelope?.request as ReplyTicketPatchRequest;
    expect(request.comment.body).toBe(
      "<p>Yeni</p><blockquote><p>Önceki</p></blockquote>"
    );
    expect(Object.isFrozen(request)).toBe(true);
    expect(store.draftHtml).toBe("");

    if (!envelope) throw new Error("reply envelope was not created");
    store.mutationFailed(envelope, "network");
    store.setDraftHtml("<p>Başka taslak</p>");
    store.reconcileCanonical(3, "SIDE-1", [
      canonical(3, "<p>Sunucudan başka mesaj</p>", 11_000),
    ]);

    const retry = store.getRetryEnvelope(envelope.clientMessageId);
    expect(retry).toBe(envelope);
    expect(retry?.request).toBe(request);
    expect(store.getOverlayMessages(3, "SIDE-1")).toEqual([
      expect.objectContaining({
        id: envelope.clientMessageId,
        body: request.comment.body,
        status: "failed",
        errorKind: "network",
      }),
    ]);

    store.mutationStarted(retry!);
    expect(store.getOverlayMessages(3, "SIDE-1")[0]).toMatchObject({
      id: envelope.clientMessageId,
      status: "pending",
    });
  });

  it("reconciles accepted own public overlays FIFO one-to-one without dropping unmatched overlays", () => {
    store.activateSession(4, "SIDE-4");
    store.setDraftHtml("<p>Aynı</p>");
    const first = store.sendReply({
      tenantId: "tenant-1",
      parentKey: "PARENT-1",
      sideKey: "SIDE-4",
      sessionKey: 4,
      agentEmail: "agent@example.test",
      canonicalMessages: [],
    });
    store.setDraftHtml("<p>Aynı</p>");
    const second = store.sendReply({
      tenantId: "tenant-1",
      parentKey: "PARENT-1",
      sideKey: "SIDE-4",
      sessionKey: 4,
      agentEmail: "agent@example.test",
      canonicalMessages: [],
    });
    if (!first || !second) throw new Error("reply envelopes missing");

    store.mutationAccepted(first);
    store.mutationAccepted(second);
    store.reconcileCanonical(4, "SIDE-4", [
      canonical(10, "<p>Aynı</p>", 9_999),
      canonical(11, "<p>Aynı</p>", 10_001),
      canonical(12, "<p>Aynı</p>", 10_002, {
        senderEmail: "other@example.test",
      }),
      canonical(13, "<p>Aynı</p>", 10_003, { internal: true }),
    ]);

    expect(store.getOverlayMessages(4, "SIDE-4").map(({ id }) => id)).toEqual([
      second.clientMessageId,
    ]);

    store.reconcileCanonical(4, "SIDE-4", [
      canonical(11, "<p>Aynı</p>", 10_001),
      canonical(14, "<p>Aynı</p>", 10_004),
    ]);
    expect(store.getOverlayMessages(4, "SIDE-4")).toEqual([]);
  });

  it("keeps failed and unmatched accepted overlays in canonical presentation without duplicates", () => {
    store.activateSession(5, "SIDE-5");
    store.setDraftHtml("<p>Başarısız</p>");
    const failed = store.sendReply({
      tenantId: "tenant-1",
      parentKey: "PARENT-1",
      sideKey: "SIDE-5",
      sessionKey: 5,
      agentEmail: "agent@example.test",
      canonicalMessages: [],
    });
    store.setDraftHtml("<p>Kabul</p>");
    const accepted = store.sendReply({
      tenantId: "tenant-1",
      parentKey: "PARENT-1",
      sideKey: "SIDE-5",
      sessionKey: 5,
      agentEmail: "agent@example.test",
      canonicalMessages: [],
    });
    if (!failed || !accepted) throw new Error("reply envelopes missing");
    store.mutationFailed(failed, "server");
    store.mutationAccepted(accepted);

    const server = [canonical(1, "<p>Sunucu</p>", 11_000)];
    store.reconcileCanonical(5, "SIDE-5", server);
    expect(
      store
        .mergeCanonical(5, "SIDE-5", server)
        .map(({ id }) => id)
    ).toEqual([
      "comment-1",
      failed.clientMessageId,
      accepted.clientMessageId,
    ]);
  });

  it("binds create only to its active session and ignores stale A callbacks after B activates", () => {
    const first = startCreate(store, 1);
    const second = startCreate(store, 2);

    store.bindCreatedTicket(first, "SIDE-A");
    store.mutationFailed(first, "network");
    store.requestComposerFocus(1, "SIDE-A");
    store.requestScroll(1, "SIDE-A", "comment-a");

    expect(store.getOverlayMessages(2, null)[0]).toMatchObject({
      id: second.clientMessageId,
      status: "pending",
    });
    expect(store.getOverlayMessages(1, "SIDE-A")).toEqual([]);
    expect(store.consumeComposerFocus(2, null)).toBe(false);
    expect(store.consumeScrollRequest(2, null)).toBeNull();
  });

  it("creates frozen status envelopes without changing visible lifecycle optimistically", () => {
    store.activateSession(9, "SIDE-9");
    const solve = store.setSolved({
      tenantId: "tenant-1",
      parentKey: "PARENT-9",
      sideKey: "SIDE-9",
      sessionKey: 9,
      solved: false,
    });
    if (!solve) throw new Error("solve envelope missing");

    expect(solve).toMatchObject({
      kind: "solve",
      request: { fields: [{ key: "ts.status", value: "4" }] },
    });
    expect(Object.isFrozen(solve.request)).toBe(true);
    expect(store.lifecyclePending).toBe("solve");
    expect(store.lifecycleError).toBeNull();

    store.mutationFailed(solve, "server");
    expect(store.lifecyclePending).toBeNull();
    expect(store.lifecycleError).toMatchObject({
      action: "solve",
      errorKind: "server",
      clientMessageId: solve.clientMessageId,
    });
    expect(store.retryLifecycle()).toBe(solve);
  });
});
