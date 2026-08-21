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
      { key: "tp.side_conversation_parent", value: "PARENT-1" },
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
    store.setDraftHtml(
      '<p onclick="bad()">Yeni <a href="javascript:bad()">link</a></p><script>x()</script>'
    );
    const envelope = store.sendReply({
      tenantId: "tenant-1",
      parentKey: "PARENT-1",
      sideKey: "SIDE-1",
      sessionKey: 3,
      agentEmail: "agent@example.test",
    });

    expect(envelope?.kind).toBe("reply");
    const request = envelope?.request as ReplyTicketPatchRequest;
    expect(request.comment.body).toBe("<p>Yeni <a>link</a></p>");
    expect(request.comment.body).not.toMatch(/onclick|javascript:|script/i);
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

  it.each([
    [
      "<blockquote><p>Yalnız alıntı</p></blockquote>",
      "<blockquote><p>Yalnız alıntı</p></blockquote>",
    ],
    [
      "<p>Önce</p><blockquote><p>Yazılan alıntı</p></blockquote><p>Sonra</p>",
      "<p>Önce</p><blockquote><p>Yazılan alıntı</p></blockquote><p>Sonra</p>",
    ],
  ])(
    "preserves agent-authored blockquotes at the outbound reply boundary",
    (draft, expectedBody) => {
      store.activateSession(6, "SIDE-6");
      store.setAuthoredDraftHtml(draft);
      const envelope = store.sendReply({
        tenantId: "tenant-1",
        parentKey: "PARENT-1",
        sideKey: "SIDE-6",
        sessionKey: 6,
        agentEmail: "agent@example.test",
      });

      expect(envelope?.request.comment.body).toBe(expectedBody);
      expect(store.getOverlayMessages(6, "SIDE-6")[0]).toMatchObject({
        body: expectedBody,
        authoredBodyHtml: draft,
      });
    }
  );

  it("strips spoofed or inherited history before storing an untrusted restored draft", () => {
    store.activateSession(7, "SIDE-7");
    store.setDraftHtml(
      '<p>Yeni yanıt</p><blockquote data-sc-authored-quote="true"><p>Eski zincir</p></blockquote><p>Sızan devam</p>'
    );

    expect(store.draftHtml).toBe("<p>Yeni yanıt</p>");

    const envelope = store.sendReply({
      tenantId: "tenant-1",
      parentKey: "PARENT-1",
      sideKey: "SIDE-7",
      sessionKey: 7,
      agentEmail: "agent@example.test",
    });

    expect(envelope?.request.comment.body).toBe("<p>Yeni yanıt</p>");
    expect(envelope?.request.comment.body).not.toMatch(
      /Eski zincir|Sızan devam|İç not|data-sc-authored-quote/
    );
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
    });
    store.setDraftHtml("<p>Aynı</p>");
    const second = store.sendReply({
      tenantId: "tenant-1",
      parentKey: "PARENT-1",
      sideKey: "SIDE-4",
      sessionKey: 4,
      agentEmail: "agent@example.test",
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
    });
    store.setDraftHtml("<p>Kabul</p>");
    const accepted = store.sendReply({
      tenantId: "tenant-1",
      parentKey: "PARENT-1",
      sideKey: "SIDE-5",
      sessionKey: 5,
      agentEmail: "agent@example.test",
    });
    if (!failed || !accepted) throw new Error("reply envelopes missing");
    store.mutationFailed(failed, "server");
    store.mutationAccepted(accepted);

    const server = [canonical(1, "<p>Sunucu</p>", 11_000)];
    store.reconcileCanonical(5, "SIDE-5", server);
    expect(
      store.mergeCanonical(5, "SIDE-5", server).map(({ id }) => id)
    ).toEqual([failed.clientMessageId, accepted.clientMessageId, "comment-1"]);
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

describe("ActiveConversationStore attachment-id send-binding (Phase 04 Plan 06)", () => {
  let store: ActiveConversationStore;

  beforeEach(() => {
    store = new ActiveConversationStore({} as RootStore);
    jest.spyOn(Date, "now").mockReturnValue(20_000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("carries the exact caller-supplied attachment ids into the frozen reply request", () => {
    store.activateSession(1, "SIDE-1");
    store.setAuthoredDraftHtml("<p>Fatura ekte</p>");

    const envelope = store.sendReply({
      tenantId: "tenant-1",
      parentKey: "PARENT-1",
      sideKey: "SIDE-1",
      sessionKey: 1,
      agentEmail: "agent@example.test",
      attachmentIds: [630, 631],
    });

    expect(envelope?.request.comment.attachmentIds).toEqual([630, 631]);
  });

  it("omits attachmentIds entirely (never []) when no ids are given", () => {
    store.activateSession(2, "SIDE-2");
    store.setAuthoredDraftHtml("<p>Ek yok</p>");

    const withoutParam = store.sendReply({
      tenantId: "tenant-1",
      parentKey: "PARENT-1",
      sideKey: "SIDE-2",
      sessionKey: 2,
      agentEmail: "agent@example.test",
    });
    expect(withoutParam?.request.comment).not.toHaveProperty("attachmentIds");

    store.activateSession(3, "SIDE-3");
    store.setAuthoredDraftHtml("<p>Ek yok</p>");
    const withEmptyArray = store.sendReply({
      tenantId: "tenant-1",
      parentKey: "PARENT-1",
      sideKey: "SIDE-3",
      sessionKey: 3,
      agentEmail: "agent@example.test",
      attachmentIds: [],
    });
    expect(withEmptyArray?.request.comment).not.toHaveProperty(
      "attachmentIds"
    );
  });

  it("deep-freezes the reply request's comment and its attachmentIds array", () => {
    store.activateSession(4, "SIDE-4");
    store.setAuthoredDraftHtml("<p>Donmuş zarf</p>");

    const envelope = store.sendReply({
      tenantId: "tenant-1",
      parentKey: "PARENT-1",
      sideKey: "SIDE-4",
      sessionKey: 4,
      agentEmail: "agent@example.test",
      attachmentIds: [630],
    });

    expect(Object.isFrozen(envelope?.request)).toBe(true);
    expect(Object.isFrozen(envelope?.request.comment)).toBe(true);
    expect(Object.isFrozen(envelope?.request.comment.attachmentIds)).toBe(
      true
    );
  });

  it("replays the exact same attachment ids on retry after a failed send (frozen envelope replay)", () => {
    store.activateSession(5, "SIDE-5");
    store.setAuthoredDraftHtml("<p>Tekrar dene</p>");

    const envelope = store.sendReply({
      tenantId: "tenant-1",
      parentKey: "PARENT-1",
      sideKey: "SIDE-5",
      sessionKey: 5,
      agentEmail: "agent@example.test",
      attachmentIds: [630, 631],
    });
    if (!envelope) throw new Error("reply envelope was not created");

    store.mutationFailed(envelope, "network");
    const retry = store.getRetryEnvelope(envelope.clientMessageId);

    expect(retry).toBe(envelope);
    expect(retry?.request).toBe(envelope.request);
    expect(
      (retry as typeof envelope)?.request.comment.attachmentIds
    ).toEqual([630, 631]);
  });

  it("reconciles an attachment-bearing overlay by body+creator only, unaffected by attachmentIds", () => {
    store.activateSession(6, "SIDE-6");
    store.setAuthoredDraftHtml("<p>Ekli yanıt</p>");
    const envelope = store.sendReply({
      tenantId: "tenant-1",
      parentKey: "PARENT-1",
      sideKey: "SIDE-6",
      sessionKey: 6,
      agentEmail: "agent@example.test",
      attachmentIds: [630, 631],
    });
    if (!envelope) throw new Error("reply envelope was not created");
    store.mutationAccepted(envelope);

    // The canonical message carries no attachment info at all in this
    // matching path (MessageVM's optional `attachments` is irrelevant to
    // reconciliation) — body+creator alone is sufficient, exactly as before
    // this plan (RESEARCH.md Integration Pitfall #4).
    store.reconcileCanonical(6, "SIDE-6", [
      canonical(20, "<p>Ekli yanıt</p>", 20_001),
    ]);

    expect(store.getOverlayMessages(6, "SIDE-6")).toEqual([]);
  });

  it("still rejects an empty draft even when attachment ids are given (D-03)", () => {
    store.activateSession(7, "SIDE-7");
    store.setAuthoredDraftHtml("");

    const envelope = store.sendReply({
      tenantId: "tenant-1",
      parentKey: "PARENT-1",
      sideKey: "SIDE-7",
      sessionKey: 7,
      agentEmail: "agent@example.test",
      attachmentIds: [630],
    });

    expect(envelope).toBeNull();
  });
});
