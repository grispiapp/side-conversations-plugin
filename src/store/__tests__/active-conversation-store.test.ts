import { ActiveConversationStore } from "../active-conversation-store";
import { RootStore } from "../root-store";

import { grispiAPI } from "@/grispi/client/api";
import { HttpError, NetworkError } from "@/grispi/client/http-handler";
import { CreateTicketRequest, Ticket } from "@/types/grispi.type";

jest.mock("@/grispi/client/api", () => ({
  grispiAPI: {
    tickets: {
      createTicket: jest.fn(),
      getTicket: jest.fn(),
      patchTicket: jest.fn(),
    },
  },
}));

const mockedCreateTicket = grispiAPI.tickets.createTicket as jest.Mock;
const mockedGetTicket = grispiAPI.tickets.getTicket as jest.Mock;
const mockedPatchTicket = grispiAPI.tickets.patchTicket as jest.Mock;

function makeRequest(): CreateTicketRequest {
  return {
    comment: {
      body: "Merhaba, kargo durumu nedir?",
      publicVisible: true,
      creator: [{ key: "us.email", value: "agent@grispi.com" }],
    },
    fields: [
      { key: "ts.subject", value: "[DESTEK-1] Kargo sorunu" },
      { key: "ts.requester", value: ":vendor@example.com" },
      { key: "tu.side_conversation_parent", value: "DESTEK-1" },
    ],
  };
}

function makeTicketResponse(key: string): Ticket {
  return {
    key,
    callMergeStatus: null,
    channel: "INTEGRATION",
    form: {} as Ticket["form"],
    createdAt: 0,
    updatedAt: 0,
    solvedAt: null,
    comments: [],
    fieldMap: {},
    relation: [],
    resolution: null,
  };
}

function makeCreator(
  id: number,
  authority: "ROLE_ADMIN" | "ROLE_END_USER",
  email: string,
  fullName: string
): Ticket["comments"][number]["creator"] {
  return {
    id,
    email,
    fullName,
    role: {
      authority,
      impliedAuthorities: [],
      teamUser: authority !== "ROLE_END_USER",
    },
  } as unknown as Ticket["comments"][number]["creator"];
}

function makeComment(
  id: number,
  createdAt: number,
  body: string,
  creator: Ticket["comments"][number]["creator"],
  publicVisible = true
): Ticket["comments"][number] {
  return {
    attachments: [],
    id,
    body,
    publicVisible,
    ticketKey: "SIDE-1",
    createdAt,
    creator,
    call: null,
    toId: null,
    toEmail: null,
    commentCCs: [],
    mentionedUsers: [],
    channel: "EMAIL",
    externalId: "",
  };
}

function makeLoadedTicket(
  key: string,
  comments: Ticket["comments"],
  status = "2"
): Ticket {
  return {
    ...makeTicketResponse(key),
    comments,
    fieldMap: {
      "ts.requester": { key: "ts.requester", value: "7" },
      "ts.subject": { key: "ts.subject", value: "Tedarikçi takibi" },
      "ts.status": { key: "ts.status", value: status },
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Flushes background create/reply/lifecycle promise chains before assertions. */
async function flushPromises(): Promise<void> {
  for (let index = 0; index < 10; index += 1) {
    await Promise.resolve();
  }
}

describe("ActiveConversationStore", () => {
  let rootStore: RootStore;
  let store: ActiveConversationStore;

  beforeEach(() => {
    mockedCreateTicket.mockReset();
    mockedGetTicket.mockReset();
    mockedPatchTicket.mockReset();
    rootStore = {} as RootStore;
    store = new ActiveConversationStore(rootStore);
  });

  it("startNew adds a single pending own message and echoes recipient/subject", async () => {
    // Resolved (not hanging) so the background POST cleanly settles by the
    // end of this test — only the SYNCHRONOUS state right after the call is
    // under test here (the resolved-state assertions live in the next test).
    mockedCreateTicket.mockResolvedValueOnce(makeTicketResponse("TICKET-999"));

    store.startNew({
      recipientLabel: "Vendor Co",
      subject: "[DESTEK-1] Kargo sorunu",
      body: "Merhaba, kargo durumu nedir?",
      request: makeRequest(),
      parentKey: "DESTEK-1",
    });

    expect(store.messages).toHaveLength(1);
    expect(store.messages[0]).toMatchObject({
      direction: "own",
      status: "pending",
      body: "Merhaba, kargo durumu nedir?",
    });
    expect(store.recipientLabel).toBe("Vendor Co");
    expect(store.subject).toBe("[DESTEK-1] Kargo sorunu");

    await flushPromises();
  });

  it("resolves the message to sent and sets ticketKey without a MobX list refresh", async () => {
    mockedCreateTicket.mockResolvedValueOnce(makeTicketResponse("TICKET-580"));

    store.startNew({
      recipientLabel: "Vendor Co",
      subject: "[DESTEK-1] Kargo sorunu",
      body: "Merhaba",
      request: makeRequest(),
      parentKey: "DESTEK-1",
    });

    await flushPromises();

    expect(store.messages[0].status).toBe("sent");
    expect(store.ticketKey).toBe("TICKET-580");
  });

  it("does not require a MobX list owner after a successful create", async () => {
    mockedCreateTicket.mockResolvedValueOnce(makeTicketResponse("TICKET-582"));
    const isolated = new ActiveConversationStore({} as RootStore);

    isolated.startNew({
      recipientLabel: "Vendor Co",
      subject: "[DESTEK-1] Kargo sorunu",
      body: "Merhaba",
      request: makeRequest(),
      parentKey: "DESTEK-1",
    });
    await flushPromises();

    expect(isolated.messages[0].status).toBe("sent");
    expect(isolated.ticketKey).toBe("TICKET-582");
  });

  it("marks the message failed with body preserved on a network error, and never refetches the list", async () => {
    mockedCreateTicket.mockRejectedValueOnce(
      new NetworkError(new Error("offline"))
    );

    store.startNew({
      recipientLabel: "Vendor Co",
      subject: "[DESTEK-1] Kargo sorunu",
      body: "Merhaba",
      request: makeRequest(),
      parentKey: "DESTEK-1",
    });

    await flushPromises();

    expect(store.messages[0].status).toBe("failed");
    expect(store.messages[0].errorKind).toBe("network");
    expect(store.messages[0].body).toBe("Merhaba");
  });

  it("marks the message failed with the server errorKind on an HttpError (T-02-03 — body/status never captured)", async () => {
    mockedCreateTicket.mockRejectedValueOnce(
      new HttpError(422, { message: "boom" })
    );

    store.startNew({
      recipientLabel: "Vendor Co",
      subject: "s",
      body: "Merhaba",
      request: makeRequest(),
      parentKey: "DESTEK-1",
    });

    await flushPromises();

    expect(store.messages[0].status).toBe("failed");
    expect(store.messages[0].errorKind).toBe("server");
  });

  it("retry(messageId) re-sends the identical POST and resolves to sent (D-15)", async () => {
    mockedCreateTicket.mockRejectedValueOnce(
      new NetworkError(new Error("offline"))
    );

    store.startNew({
      recipientLabel: "Vendor Co",
      subject: "s",
      body: "Merhaba",
      request: makeRequest(),
      parentKey: "DESTEK-1",
    });

    await flushPromises();
    expect(store.messages[0].status).toBe("failed");

    const messageId = store.messages[0].id;
    mockedCreateTicket.mockResolvedValueOnce(makeTicketResponse("TICKET-581"));

    store.retry(messageId);
    expect(store.messages[0].status).toBe("pending");

    await flushPromises();

    expect(mockedCreateTicket).toHaveBeenCalledTimes(2);
    expect(mockedCreateTicket).toHaveBeenNthCalledWith(2, makeRequest());
    expect(store.messages[0].status).toBe("sent");
    expect(store.ticketKey).toBe("TICKET-581");
  });

  it("startNew RESETS state instead of appending — no message bleed across consecutive conversations (M-4)", async () => {
    mockedCreateTicket.mockResolvedValueOnce(makeTicketResponse("TICKET-580"));

    store.startNew({
      recipientLabel: "Vendor A",
      subject: "[DESTEK-1] A konusu",
      body: "A'ya mesaj",
      request: makeRequest(),
      parentKey: "DESTEK-1",
    });

    await flushPromises();

    expect(store.messages).toHaveLength(1);
    expect(store.ticketKey).toBe("TICKET-580");

    mockedCreateTicket.mockResolvedValueOnce(makeTicketResponse("TICKET-999"));

    store.startNew({
      recipientLabel: "Vendor B",
      subject: "[DESTEK-2] B konusu",
      body: "B'ye mesaj",
      request: makeRequest(),
      parentKey: "DESTEK-2",
    });

    // Synchronously, right after the second startNew — before its POST
    // settles — the store must already show ONLY the new conversation's
    // single pending message, not A's leftover bubble plus B's.
    expect(store.messages).toHaveLength(1);
    expect(store.messages[0]).toMatchObject({
      status: "pending",
      body: "B'ye mesaj",
    });
    expect(store.recipientLabel).toBe("Vendor B");
    expect(store.subject).toBe("[DESTEK-2] B konusu");
    // The stale ticketKey from conversation A must not leak into B's
    // pre-resolution state.
    expect(store.ticketKey).toBeNull();

    await flushPromises();

    expect(store.messages).toHaveLength(1);
    expect(store.messages[0].status).toBe("sent");
    expect(store.ticketKey).toBe("TICKET-999");
  });

  it("message list updates are immutable (new array identity on every transition)", async () => {
    mockedCreateTicket.mockResolvedValueOnce(makeTicketResponse("TICKET-580"));

    store.startNew({
      recipientLabel: "Vendor Co",
      subject: "s",
      body: "Merhaba",
      request: makeRequest(),
      parentKey: "DESTEK-1",
    });

    const pendingMessages = store.messages;
    await flushPromises();

    expect(store.messages).not.toBe(pendingMessages);
  });

  describe("real thread loading", () => {
    const external = makeCreator(
      7,
      "ROLE_END_USER",
      "vendor@example.com",
      "Vendor Person"
    );
    const agent = makeCreator(9, "ROLE_ADMIN", "agent@grispi.com", "Agent");

    beforeEach(() => {
      window.localStorage.clear();
    });

    it("sorts and sanitizes comments, splits quotes, and classifies incoming, own, and internal messages", async () => {
      mockedGetTicket.mockResolvedValue(
        makeLoadedTicket("SIDE-1", [
          makeComment(
            3,
            3000,
            '<p onclick="bad()">Not</p><script>bad()</script>',
            agent,
            false
          ),
          makeComment(
            2,
            2000,
            "<p>Own</p><blockquote><p>Old</p></blockquote>",
            agent
          ),
          makeComment(1, 1000, "<p>Incoming</p>", external),
        ])
      );

      await store.load("SIDE-1", "PARENT-1");

      expect(store.status).toBe("ready");
      expect(store.messages.map((message) => message.id)).toEqual([
        "comment-1",
        "comment-2",
        "comment-3",
      ]);
      expect(store.messages).toEqual([
        expect.objectContaining({
          direction: "incoming",
          body: "<p>Incoming</p>",
          senderName: "Vendor Person",
          senderEmail: "vendor@example.com",
          internal: false,
        }),
        expect.objectContaining({
          direction: "own",
          body: "<p>Own</p><blockquote><p>Old</p></blockquote>",
          quotedHtml: "<p>Old</p>",
          internal: false,
        }),
        expect.objectContaining({
          direction: "own",
          body: "<p>Not</p>",
          internal: true,
        }),
      ]);
      expect(store.recipientLabel).toBe("Vendor Person <vendor@example.com>");
      expect(store.subject).toBe("Tedarikçi takibi");
      expect(store.solved).toBe(false);
    });

    it("keeps the later selection authoritative when an earlier load resolves last", async () => {
      const first = deferred<Ticket>();
      const second = deferred<Ticket>();
      mockedGetTicket
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);

      const firstLoad = store.load("SIDE-OLD", "PARENT-OLD");
      const secondLoad = store.load("SIDE-NEW", "PARENT-NEW");

      second.resolve(
        makeLoadedTicket("SIDE-NEW", [
          makeComment(20, 2000, "<p>New</p>", external),
        ])
      );
      await secondLoad;
      first.resolve(
        makeLoadedTicket("SIDE-OLD", [
          makeComment(10, 1000, "<p>Old</p>", external),
        ])
      );
      await firstLoad;

      expect(store.ticketKey).toBe("SIDE-NEW");
      expect(store.parentKey).toBe("PARENT-NEW");
      expect(store.messages[0].id).toBe("comment-20");
    });

    it("targets the earliest unseen external message but advances last-seen to the latest external timestamp", async () => {
      window.localStorage.setItem("sc:lastSeenAt:SIDE-1", "1000");
      mockedGetTicket.mockResolvedValue(
        makeLoadedTicket("SIDE-1", [
          makeComment(1, 1000, "<p>Seen</p>", external),
          makeComment(2, 2000, "<p>Unseen first</p>", external),
          makeComment(3, 3000, "<p>Agent</p>", agent),
          makeComment(4, 4000, "<p>Unseen latest</p>", external),
        ])
      );

      await store.load("SIDE-1", "PARENT-1");

      expect(store.scrollTargetMessageId).toBe("comment-2");
      expect(store.latestRelevantExternalAt).toBe(4000);
      expect(window.localStorage.getItem("sc:lastSeenAt:SIDE-1")).toBe("4000");
    });

    it("targets the final message when there is no unseen external message and never regresses last-seen", async () => {
      window.localStorage.setItem("sc:lastSeenAt:SIDE-1", "9000");
      mockedGetTicket.mockResolvedValue(
        makeLoadedTicket("SIDE-1", [
          makeComment(1, 1000, "<p>External</p>", external),
          makeComment(2, 2000, "<p>Agent</p>", agent),
        ])
      );

      await store.load("SIDE-1", "PARENT-1");

      expect(store.scrollTargetMessageId).toBe("comment-2");
      expect(store.latestRelevantExternalAt).toBe(1000);
      expect(window.localStorage.getItem("sc:lastSeenAt:SIDE-1")).toBe("9000");
    });

    it("exposes a safe retryable Turkish load error and never marks last-seen", async () => {
      const setItem = jest.spyOn(Storage.prototype, "setItem");
      mockedGetTicket.mockRejectedValue(
        new HttpError(500, { private: "do not expose" })
      );

      await store.load("SIDE-1", "PARENT-1");

      expect(store.status).toBe("error");
      expect(store.loadError).toBe(
        "Görüşme yüklenemedi. Lütfen tekrar deneyin."
      );
      expect(store.ticketKey).toBe("SIDE-1");
      expect(setItem).not.toHaveBeenCalled();
    });

    it("keeps a successful load ready when last-seen storage throws", async () => {
      jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("storage denied");
      });
      mockedGetTicket.mockResolvedValue(
        makeLoadedTicket("SIDE-1", [
          makeComment(1, 1000, "<p>External</p>", external),
        ])
      );

      await store.load("SIDE-1", "PARENT-1");

      expect(store.status).toBe("ready");
      expect(store.messages).toHaveLength(1);
    });
  });

  describe("reply and lifecycle mutations", () => {
    const external = makeCreator(
      7,
      "ROLE_END_USER",
      "vendor@example.com",
      "Vendor Person"
    );
    const agent = makeCreator(9, "ROLE_ADMIN", "agent@grispi.com", "Agent");

    async function loadOpenThread(): Promise<void> {
      mockedGetTicket.mockResolvedValueOnce(
        makeLoadedTicket("SIDE-1", [
          makeComment(
            1,
            1000,
            "<p>Public 1</p><blockquote><p>Old quote</p></blockquote>",
            external
          ),
          makeComment(
            2,
            2000,
            '<p onclick="steal()">Internal secret</p>',
            agent,
            false
          ),
          makeComment(
            3,
            3000,
            "<p>Public 2<script>steal()</script></p>",
            agent
          ),
        ])
      );
      await store.load("SIDE-1", "PARENT-1");
    }

    it("clears the draft immediately, sends one sanitized quoted context, and retries the exact body without quote duplication", async () => {
      await loadOpenThread();
      const firstAttempt = deferred<never>();
      mockedPatchTicket.mockReturnValueOnce(firstAttempt.promise);

      store.setDraftHtml(
        '<p onclick="steal()">New <strong>reply</strong></p><script>bad()</script>'
      );
      store.sendReply("agent@grispi.com");

      const optimistic = store.messages[store.messages.length - 1];
      expect(store.draftHtml).toBe("");
      expect(optimistic).toMatchObject({
        direction: "own",
        status: "pending",
        body: "<p>New <strong>reply</strong></p><blockquote><p>Public 1</p><p>Public 2</p></blockquote>",
      });

      const expectedRequest = {
        comment: {
          body: "<p>New <strong>reply</strong></p><blockquote><p>Public 1</p><p>Public 2</p></blockquote>",
          publicVisible: true,
          creator: [{ key: "us.email", value: "agent@grispi.com" }],
        },
      };
      expect(mockedPatchTicket).toHaveBeenLastCalledWith(
        "SIDE-1",
        expectedRequest
      );
      expect(expectedRequest).not.toHaveProperty("fields");
      expect(expectedRequest.comment.body.match(/<blockquote>/g)).toHaveLength(
        1
      );
      expect(expectedRequest.comment.body).not.toContain("Internal secret");
      expect(expectedRequest.comment.body).not.toContain("Old quote");
      expect(expectedRequest.comment.body).not.toMatch(/onclick|script/i);

      firstAttempt.reject(new NetworkError(new Error("offline")));
      await flushPromises();
      expect(store.messages[store.messages.length - 1]).toMatchObject({
        id: optimistic.id,
        status: "failed",
        errorKind: "network",
      });

      mockedPatchTicket.mockRejectedValueOnce(new HttpError(500, {}));
      store.retry(optimistic.id);
      await flushPromises();

      expect(mockedPatchTicket).toHaveBeenCalledTimes(2);
      expect(mockedPatchTicket).toHaveBeenNthCalledWith(
        2,
        "SIDE-1",
        expectedRequest
      );
      expect(
        mockedPatchTicket.mock.calls[1][1].comment.body.match(/<blockquote>/g)
      ).toHaveLength(1);
    });

    it("refetches only the canonical active ticket after reply success", async () => {
      await loadOpenThread();
      mockedPatchTicket.mockResolvedValueOnce({ key: "SIDE-1" });
      mockedGetTicket.mockResolvedValueOnce(
        makeLoadedTicket("SIDE-1", [
          makeComment(1, 1000, "<p>Public 1</p>", external),
          makeComment(4, 4000, "<p>Canonical reply</p>", agent),
        ])
      );

      store.setDraftHtml("<p>Reply</p>");
      store.sendReply("agent@grispi.com");
      await flushPromises();

      expect(mockedGetTicket).toHaveBeenCalledTimes(2);
      expect(store.messages.map((message) => message.id)).toEqual([
        "comment-1",
        "comment-4",
      ]);
    });

    it("does not send replies while solved", async () => {
      mockedGetTicket.mockResolvedValueOnce(
        makeLoadedTicket(
          "SIDE-1",
          [makeComment(1, 1000, "<p>External</p>", external)],
          "4"
        )
      );
      await store.load("SIDE-1", "PARENT-1");

      store.setDraftHtml("<p>Blocked</p>");
      store.sendReply("agent@grispi.com");

      expect(mockedPatchTicket).not.toHaveBeenCalled();
      expect(store.draftHtml).toBe("<p>Blocked</p>");
    });

    it("uses status-only SOLVED body, keeps open state on failure, and retries without optimistic lifecycle changes", async () => {
      await loadOpenThread();
      mockedPatchTicket.mockRejectedValueOnce(new NetworkError(new Error("x")));

      store.setSolved();
      expect(store.solved).toBe(false);
      expect(store.lifecyclePending).toBe("solve");
      expect(mockedPatchTicket).toHaveBeenCalledWith("SIDE-1", {
        fields: [{ key: "ts.status", value: "4" }],
      });
      expect(mockedPatchTicket.mock.calls[0][1]).not.toHaveProperty("comment");

      await flushPromises();
      expect(store.solved).toBe(false);
      expect(store.lifecyclePending).toBeNull();
      expect(store.lifecycleError).toEqual({
        action: "solve",
        errorKind: "network",
      });

      mockedPatchTicket.mockRejectedValueOnce(new HttpError(500, {}));
      store.retryLifecycle();
      expect(store.solved).toBe(false);
      expect(mockedPatchTicket).toHaveBeenNthCalledWith(2, "SIDE-1", {
        fields: [{ key: "ts.status", value: "4" }],
      });
      await flushPromises();
    });

    it("accepts solved state only from the canonical refetch after SOLVED succeeds", async () => {
      await loadOpenThread();
      mockedPatchTicket.mockResolvedValueOnce({ key: "SIDE-1" });
      mockedGetTicket.mockResolvedValueOnce(
        makeLoadedTicket(
          "SIDE-1",
          [makeComment(1, 1000, "<p>External</p>", external)],
          "4"
        )
      );

      store.setSolved();
      expect(store.solved).toBe(false);
      await flushPromises();

      expect(store.solved).toBe(true);
      expect(store.status).toBe("ready");
    });

    it("uses status-only OPEN body, refetches server truth, and exposes one-shot composer focus after reopen", async () => {
      mockedGetTicket.mockResolvedValueOnce(
        makeLoadedTicket(
          "SIDE-1",
          [makeComment(1, 1000, "<p>External</p>", external)],
          "4"
        )
      );
      await store.load("SIDE-1", "PARENT-1");

      mockedPatchTicket.mockResolvedValueOnce({ key: "SIDE-1" });
      mockedGetTicket.mockResolvedValueOnce(
        makeLoadedTicket(
          "SIDE-1",
          [makeComment(1, 1000, "<p>External</p>", external)],
          "2"
        )
      );

      store.reopen();
      expect(store.solved).toBe(true);
      expect(mockedPatchTicket).toHaveBeenCalledWith("SIDE-1", {
        fields: [{ key: "ts.status", value: "2" }],
      });
      expect(mockedPatchTicket.mock.calls[0][1]).not.toHaveProperty("comment");
      await flushPromises();

      expect(store.solved).toBe(false);
      expect(store.consumeComposerFocus()).toBe(true);
      expect(store.consumeComposerFocus()).toBe(false);
    });
  });
});
