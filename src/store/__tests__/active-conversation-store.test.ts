import { grispiAPI } from "@/grispi/client/api";
import { HttpError, NetworkError } from "@/grispi/client/http-handler";
import { CreateTicketRequest, Ticket } from "@/types/grispi.type";

import { ActiveConversationStore } from "../active-conversation-store";
import { RootStore } from "../root-store";

jest.mock("@/grispi/client/api", () => ({
  grispiAPI: {
    tickets: {
      createTicket: jest.fn(),
    },
  },
}));

const mockedCreateTicket = grispiAPI.tickets.createTicket as jest.Mock;

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

/** Flushes the microtask queue enough times for `sendCreateTicket`'s two
 * chained `await`s (createTicket POST, then `sideConversations.load`) to
 * settle before assertions run — same idiom as compose-store.test.ts's
 * `advanceDebounceAndFlush`, minus the fake timer. */
async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("ActiveConversationStore", () => {
  let loadMock: jest.Mock;
  let rootStore: RootStore;
  let store: ActiveConversationStore;

  beforeEach(() => {
    mockedCreateTicket.mockReset();
    loadMock = jest.fn().mockResolvedValue(undefined);
    rootStore = {
      sideConversations: { load: loadMock },
    } as unknown as RootStore;
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

  it("resolves the message to sent, sets ticketKey from the response .key, and refetches the list (SYNC-02)", async () => {
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
    expect(loadMock).toHaveBeenCalledWith("DESTEK-1");
  });

  it("marks the message failed with body preserved on a network error, and never refetches the list", async () => {
    mockedCreateTicket.mockRejectedValueOnce(new NetworkError(new Error("offline")));

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
    expect(loadMock).not.toHaveBeenCalled();
  });

  it("marks the message failed with the server errorKind on an HttpError (T-02-03 — body/status never captured)", async () => {
    mockedCreateTicket.mockRejectedValueOnce(new HttpError(422, { message: "boom" }));

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

  it("retry(messageId) re-sends the identical POST and resolves to sent + refetches (D-15)", async () => {
    mockedCreateTicket.mockRejectedValueOnce(new NetworkError(new Error("offline")));

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
    expect(loadMock).toHaveBeenCalledWith("DESTEK-1");
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
});
