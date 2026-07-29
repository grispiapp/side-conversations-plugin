import { QueryClientProvider } from "@tanstack/react-query";
import { ReactElement, act } from "react";
import { Root, createRoot } from "react-dom/client";

import { grispiAPI } from "@/grispi/client/api";
import { NetworkError } from "@/grispi/client/http-handler";
import { SIDE_CONVERSATION_PARENT_FIELD_KEY } from "@/lib/side-conversation";
import { createTestQueryClient } from "@/query/query-client";
import {
  customerSearchOptions,
  executeCreateMutation,
  executeReplyMutation,
  executeStatusMutation,
  sideConversationDetailOptions,
  sideConversationListOptions,
  useCustomersQuery,
  useSideConversationDetailQuery,
} from "@/query/side-conversation-queries";
import { ActiveConversationStore } from "@/store/active-conversation-store";
import { RootStore } from "@/store/root-store";
import {
  AdvancedSearchResponse,
  Customer,
  CustomerSearchResponse,
  Ticket,
} from "@/types/grispi.type";

jest.mock("@/grispi/client/api", () => ({
  grispiAPI: {
    tickets: {
      advancedSearch: jest.fn(),
      createTicket: jest.fn(),
      getTicket: jest.fn(),
      patchTicket: jest.fn(),
    },
    customers: {
      search: jest.fn(),
    },
    users: {
      getUser: jest.fn(),
    },
  },
}));

const mockedAdvancedSearch = grispiAPI.tickets.advancedSearch as jest.Mock;
const mockedCreateTicket = grispiAPI.tickets.createTicket as jest.Mock;
const mockedGetTicket = grispiAPI.tickets.getTicket as jest.Mock;
const mockedPatchTicket = grispiAPI.tickets.patchTicket as jest.Mock;
const mockedCustomerSearch = grispiAPI.customers.search as jest.Mock;
const mockedGetUser = grispiAPI.users.getUser as jest.Mock;

function makeTicket(key: string, requesterId = 7): Ticket {
  return {
    key,
    callMergeStatus: null,
    channel: "EMAIL",
    form: {} as Ticket["form"],
    createdAt: 0,
    updatedAt: 0,
    solvedAt: null,
    comments: [
      {
        attachments: [],
        id: 1,
        body: `<p>Message ${key}</p>`,
        publicVisible: true,
        ticketKey: key,
        createdAt: 1000,
        creator: {
          id: requesterId,
          email: `${key.toLowerCase()}@example.test`,
          role: {
            authority: "ROLE_END_USER",
            impliedAuthorities: [],
            teamUser: false,
          },
        } as unknown as Ticket["comments"][number]["creator"],
        call: null,
        toId: null,
        toEmail: null,
        commentCCs: [],
        mentionedUsers: [],
        channel: "EMAIL",
        externalId: "",
      },
    ],
    fieldMap: {
      "ts.requester": {
        key: "ts.requester",
        value: String(requesterId),
      },
    },
    relation: [],
    resolution: null,
  };
}

function makeListPage(
  pageNumber: number,
  totalPages: number
): AdvancedSearchResponse {
  return {
    content: [{ key: `SIDE-${pageNumber + 1}` }],
    totalPages,
    totalSize: totalPages,
    pageNumber,
    numberOfElements: 1,
  };
}

function makeCustomerPage(content: Customer[] = []): CustomerSearchResponse {
  return {
    content,
    totalPages: 1,
    totalSize: content.length,
    pageNumber: 0,
    numberOfElements: content.length,
  };
}

function makeCustomer(id: number, email: string, fullName: string): Customer {
  return {
    id,
    email,
    emails: [email],
    fullName,
    firstName: null,
    lastName: null,
    phone: null,
    phones: [],
    organization: null,
    language: null,
    tags: [],
    fieldMap: {},
    role: "ROLE_END_USER",
    createdAt: 0,
    updatedAt: 0,
    groups: null,
    enabled: true,
  };
}

describe("side-conversation query contracts", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedGetTicket.mockImplementation((key: string) =>
      Promise.resolve(makeTicket(key))
    );
    mockedGetUser.mockResolvedValue(null);
    window.localStorage.clear();
  });

  it("defines a page-size-10 infinite list with exact tenant key and page progression", async () => {
    const firstPage = makeListPage(0, 2);
    mockedAdvancedSearch.mockResolvedValue(firstPage);
    const options = sideConversationListOptions("tenant-1", "TICKET-1");
    const client = createTestQueryClient();

    const data = await client.fetchInfiniteQuery(options);

    expect(options.queryKey).toEqual([
      "side-conversations",
      "tenant-1",
      "TICKET-1",
    ]);
    expect(options.initialPageParam).toBe(0);
    expect(mockedAdvancedSearch).toHaveBeenCalledWith(
      {
        allConditions: [
          {
            fieldKey: SIDE_CONVERSATION_PARENT_FIELD_KEY,
            operator: "EQUAL",
            value: "TICKET-1",
          },
        ],
        anyConditions: [],
      },
      { size: 10, page: 0 }
    );
    expect(options.getNextPageParam(data.pages[0], data.pages, 0, [0])).toBe(1);
    expect(
      options.getNextPageParam(
        { ...data.pages[0], pageNumber: 1 },
        [data.pages[0], { ...data.pages[0], pageNumber: 1 }],
        1,
        [0, 1]
      )
    ).toBeUndefined();
    expect(options).not.toHaveProperty("placeholderData");
    expect(options).not.toHaveProperty("initialData");
  });

  it("defines exact finite no-polling list and detail policies", async () => {
    const ticket = { key: "SIDE-1" } as Ticket;
    mockedGetTicket.mockResolvedValue(ticket);
    const list = sideConversationListOptions("tenant-1", "TICKET-1");
    const detail = sideConversationDetailOptions("tenant-1", "SIDE-1");
    const client = createTestQueryClient();

    await client.fetchQuery(detail);

    expect(list.staleTime).toBe(30_000);
    expect(detail.queryKey).toEqual([
      "side-conversation",
      "tenant-1",
      "SIDE-1",
    ]);
    expect(detail.staleTime).toBe(15_000);
    for (const options of [list, detail]) {
      expect(options.refetchInterval).toBe(false);
      expect(options.refetchOnWindowFocus).toBe(false);
      expect(options.refetchOnReconnect).toBe(true);
    }
    expect(mockedGetTicket).toHaveBeenCalledWith("SIDE-1");
  });

  it("normalizes customer terms once and enforces the three-character gate", async () => {
    mockedCustomerSearch.mockResolvedValue(makeCustomerPage());
    const enabled = customerSearchOptions("tenant-1", "  ALIce ");
    const tooShort = customerSearchOptions("tenant-1", " Al ");
    const client = createTestQueryClient();

    await client.fetchQuery(enabled);

    expect(enabled.queryKey).toEqual(["customers", "tenant-1", "alice"]);
    expect(enabled.enabled).toBe(true);
    expect(enabled.staleTime).toBe(30_000);
    expect(enabled.refetchInterval).toBe(false);
    expect(enabled.refetchOnWindowFocus).toBe(false);
    expect(enabled.refetchOnReconnect).toBe(true);
    expect(mockedCustomerSearch).toHaveBeenCalledWith({
      searchTerm: "alice",
      size: 10,
      page: 0,
    });
    expect(tooShort.queryKey).toEqual(["customers", "tenant-1", "al"]);
    expect(tooShort.enabled).toBe(false);
  });

  it("disables every contract while tenant or resource identity is absent", () => {
    expect(sideConversationListOptions(null, "TICKET-1").enabled).toBe(false);
    expect(sideConversationListOptions("tenant-1", null).enabled).toBe(false);
    expect(sideConversationDetailOptions(null, "SIDE-1").enabled).toBe(false);
    expect(sideConversationDetailOptions("tenant-1", null).enabled).toBe(false);
    expect(customerSearchOptions(null, "alice").enabled).toBe(false);

    expect(mockedAdvancedSearch).not.toHaveBeenCalled();
    expect(mockedGetTicket).not.toHaveBeenCalled();
    expect(mockedCustomerSearch).not.toHaveBeenCalled();
  });

  it("keeps identical parent values isolated across fresh tenant clients", async () => {
    const tenantOneClient = createTestQueryClient();
    const tenantTwoClient = createTestQueryClient();
    const tenantOne = sideConversationListOptions("tenant-1", "TICKET-1");
    const tenantTwo = sideConversationListOptions("tenant-2", "TICKET-1");

    tenantOneClient.setQueryData(tenantOne.queryKey, {
      pages: [makeListPage(0, 1)],
      pageParams: [0],
    });

    expect(tenantOne.queryKey).not.toEqual(tenantTwo.queryKey);
    expect(tenantTwoClient.getQueryData(tenantTwo.queryKey)).toBeUndefined();
  });

  it("hydrates each summary into projected rows inside the Query-owned page", async () => {
    mockedAdvancedSearch.mockResolvedValue(makeListPage(0, 1));
    const client = createTestQueryClient();

    const data = await client.fetchInfiniteQuery(
      sideConversationListOptions("tenant-1", "TICKET-1")
    );

    expect(data.pages[0].rows).toEqual([
      expect.objectContaining({
        key: "SIDE-1",
        recipientEmail: "side-1@example.test",
        summary: "Message SIDE-1",
        hydrationFailed: false,
      }),
    ]);
  });

  it("settles hydration failures, retries exactly once and keeps a neutral ready row when repair fails", async () => {
    mockedAdvancedSearch.mockResolvedValue(makeListPage(0, 1));
    mockedGetTicket.mockRejectedValue(new Error("private failure"));
    const client = createTestQueryClient();

    const data = await client.fetchInfiniteQuery(
      sideConversationListOptions("tenant-1", "TICKET-1")
    );

    expect(mockedGetTicket).toHaveBeenCalledTimes(2);
    expect(data.pages[0].rows[0]).toMatchObject({
      key: "SIDE-1",
      recipientEmail: "—",
      actionBadge: null,
      hydrationFailed: true,
    });
  });

  it("uses the users endpoint as the neutral recipient fallback without exposing a raw ticket key", async () => {
    mockedAdvancedSearch.mockResolvedValue(makeListPage(0, 1));
    mockedGetTicket.mockResolvedValue({
      ...makeTicket("SIDE-1", 92),
      comments: [],
    });
    mockedGetUser.mockResolvedValue({
      id: 92,
      primaryEmail: "requester@example.test",
    });
    const client = createTestQueryClient();

    const data = await client.fetchInfiniteQuery(
      sideConversationListOptions("tenant-1", "TICKET-1")
    );

    expect(mockedGetUser).toHaveBeenCalledWith(92);
    expect(data.pages[0].rows[0].recipientEmail).toBe("requester@example.test");
    expect(data.pages[0].rows[0].recipientEmail).not.toBe("SIDE-1");
  });
});

describe("useCustomersQuery", () => {
  let container: HTMLDivElement;
  let root: Root;
  let client: ReturnType<typeof createTestQueryClient>;

  function Harness({ tenantId, term }: { tenantId: string; term: string }) {
    const query = useCustomersQuery(tenantId, term);
    return (
      <div data-waiting={String(query.isDebouncing || query.isPending)}>
        {query.customers.map((customer) => customer.email).join(",")}
      </div>
    );
  }

  function render(ui: ReactElement): void {
    act(() => {
      root.render(
        <QueryClientProvider client={client}>{ui}</QueryClientProvider>
      );
    });
  }

  async function advanceAndFlush(ms: number): Promise<void> {
    await act(async () => {
      jest.advanceTimersByTime(ms);
      for (let index = 0; index < 10; index += 1) {
        await Promise.resolve();
        jest.advanceTimersByTime(0);
      }
    });
  }

  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetAllMocks();
    client = createTestQueryClient();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    client.clear();
    jest.useRealTimers();
  });

  it("waits 300ms, normalizes the term and publishes Query-owned customers", async () => {
    mockedCustomerSearch.mockResolvedValue(
      makeCustomerPage([makeCustomer(1, "ada@example.test", "Ada")])
    );

    render(<Harness tenantId="tenant-1" term="  ADA " />);
    expect(mockedCustomerSearch).not.toHaveBeenCalled();
    expect(container.textContent).toBe("");

    await advanceAndFlush(299);
    expect(mockedCustomerSearch).not.toHaveBeenCalled();

    await advanceAndFlush(1);
    await advanceAndFlush(0);
    expect(mockedCustomerSearch).toHaveBeenCalledWith({
      searchTerm: "ada",
      size: 10,
      page: 0,
    });
    expect(container.textContent).toBe("ada@example.test");
  });

  it("never renders an earlier term or tenant result under the current key", async () => {
    let resolveOld!: (value: CustomerSearchResponse) => void;
    mockedCustomerSearch
      .mockReturnValueOnce(
        new Promise<CustomerSearchResponse>((resolve) => {
          resolveOld = resolve;
        })
      )
      .mockResolvedValueOnce(
        makeCustomerPage([makeCustomer(2, "new@example.test", "New")])
      )
      .mockResolvedValueOnce(
        makeCustomerPage([makeCustomer(3, "tenant2@example.test", "T2")])
      );

    render(<Harness tenantId="tenant-1" term="old" />);
    await advanceAndFlush(300);
    await advanceAndFlush(0);

    render(<Harness tenantId="tenant-1" term="new" />);
    expect(container.textContent).toBe("");
    await advanceAndFlush(300);
    await advanceAndFlush(0);
    expect(container.textContent).toBe("new@example.test");

    resolveOld(makeCustomerPage([makeCustomer(1, "old@example.test", "Old")]));
    await advanceAndFlush(0);
    expect(container.textContent).toBe("new@example.test");

    render(<Harness tenantId="tenant-2" term="new" />);
    expect(container.textContent).toBe("");
    await advanceAndFlush(0);
    await advanceAndFlush(0);
    expect(container.textContent).toBe("tenant2@example.test");
    expect(mockedCustomerSearch).toHaveBeenLastCalledWith({
      searchTerm: "new",
      size: 10,
      page: 0,
    });
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("canonical detail and mutation executors", () => {
  let client: ReturnType<typeof createTestQueryClient>;
  let store: ActiveConversationStore;
  let selected: {
    ticketKey: string | null;
    parentKey: string;
    sessionKey: number;
  };

  function boundary() {
    return {
      activeConversation: store,
      getSelectedConversation: () => selected,
      bindCreatedTicket: (sessionKey: number, sideKey: string) => {
        if (selected.sessionKey === sessionKey) {
          selected = { ...selected, ticketKey: sideKey };
        }
      },
    };
  }

  function replyEnvelope() {
    store.activateSession(1, "SIDE-1");
    store.setDraftHtml("<p>Yanıt</p>");
    const envelope = store.sendReply({
      tenantId: "tenant-1",
      parentKey: "PARENT-1",
      sideKey: "SIDE-1",
      sessionKey: 1,
      agentEmail: "agent@example.test",
      canonicalMessages: [],
    });
    if (!envelope) throw new Error("reply envelope missing");
    return envelope;
  }

  beforeEach(() => {
    jest.resetAllMocks();
    client = createTestQueryClient();
    store = new ActiveConversationStore({} as RootStore);
    selected = {
      ticketKey: "SIDE-1",
      parentKey: "PARENT-1",
      sessionKey: 1,
    };
  });

  afterEach(() => {
    client.clear();
  });

  it("normalizes canonical detail chronologically with safe quote/internal metadata and server lifecycle", async () => {
    const external = makeTicket("SIDE-1").comments[0].creator;
    const agent = {
      ...external,
      id: 99,
      email: "agent@example.test",
      fullName: "Agent",
      role: {
        authority: "ROLE_ADMIN",
        impliedAuthorities: [],
        teamUser: true,
      },
    };
    mockedGetTicket.mockResolvedValue({
      ...makeTicket("SIDE-1"),
      comments: [
        {
          ...makeTicket("SIDE-1").comments[0],
          id: 3,
          createdAt: 3_000,
          creator: agent,
          publicVisible: false,
          body: '<p onclick="bad()">Not</p><script>x()</script>',
        },
        {
          ...makeTicket("SIDE-1").comments[0],
          id: 2,
          createdAt: 2_000,
          creator: agent,
          body:
            "<blockquote><p>Agent quote</p></blockquote><p>After quote</p>" +
            "<blockquote><p>Incoming</p></blockquote>",
        },
        {
          ...makeTicket("SIDE-1").comments[0],
          id: 4,
          createdAt: 4_000,
          creator: agent,
          body:
            "<p>Next</p><blockquote><p>Incoming</p>" +
            "<blockquote><p>Agent quote</p></blockquote><p>After quote</p></blockquote>",
        },
        {
          ...makeTicket("SIDE-1").comments[0],
          id: 1,
          createdAt: 1_000,
          creator: external,
          body: "<p>Incoming</p>",
        },
      ],
      fieldMap: {
        "ts.requester": { key: "ts.requester", value: "7" },
        "ts.subject": { key: "ts.subject", value: "Konu" },
        "ts.status": { key: "ts.status", value: "4" },
      },
    });

    const detail = await client.fetchQuery(
      sideConversationDetailOptions("tenant-1", "SIDE-1")
    );

    expect(detail).toMatchObject({
      sideKey: "SIDE-1",
      recipientLabel: "side-1@example.test",
      subject: "Konu",
      lifecycle: "solved",
      solved: true,
      reopenable: true,
      latestRelevantExternalAt: 1_000,
    });
    expect(detail.messages).toEqual([
      expect.objectContaining({
        id: "comment-1",
        direction: "incoming",
        body: "<p>Incoming</p>",
      }),
      expect.objectContaining({
        id: "comment-2",
        direction: "own",
        authoredBodyHtml:
          "<blockquote><p>Agent quote</p></blockquote><p>After quote</p>",
        quotedHtml: "<p>Incoming</p>",
      }),
      expect.objectContaining({
        id: "comment-3",
        direction: "own",
        internal: true,
        body: "<p>Not</p>",
      }),
      expect.objectContaining({
        id: "comment-4",
        direction: "own",
        authoredBodyHtml: "<p>Next</p>",
        quotedHtml:
          "<p>Incoming</p><blockquote><p>Agent quote</p></blockquote><p>After quote</p>",
      }),
    ]);
    expect(detail.messages[3].quotedHtml).not.toContain("Not");
    expect(
      window.localStorage.getItem("sc:lastSeenAt:tenant-1:SIDE-1")
    ).toBeNull();
  });

  it("uses the same terminal lifecycle parser for status-5 detail as the list projection", async () => {
    const closedTicket = {
      ...makeTicket("SIDE-1"),
      fieldMap: {
        "ts.status": { key: "ts.status", value: "5" },
      },
    };
    mockedGetTicket.mockResolvedValue(closedTicket);

    const detail = await client.fetchQuery(
      sideConversationDetailOptions("tenant-1", "SIDE-1")
    );

    expect(detail).toMatchObject({
      lifecycle: "closed",
      solved: true,
      reopenable: false,
    });
  });

  it("does not mark a deferred stale A detail query read after the selected session moves to B", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const sideA = deferred<Ticket>();
    mockedGetTicket.mockImplementation((key: string) =>
      key === "SIDE-A" ? sideA.promise : Promise.resolve(makeTicket(key))
    );

    function DetailHarness({
      sideKey,
      parentKey,
      sessionKey,
    }: {
      sideKey: string;
      parentKey: string;
      sessionKey: number;
    }) {
      useSideConversationDetailQuery(
        "tenant-1",
        sideKey,
        parentKey,
        sessionKey,
        store,
        () => selected
      );
      return null;
    }

    selected = {
      ticketKey: "SIDE-A",
      parentKey: "PARENT-A",
      sessionKey: 1,
    };
    store.activateSession(1, "SIDE-A");
    act(() => {
      root.render(
        <QueryClientProvider client={client}>
          <DetailHarness
            sideKey="SIDE-A"
            parentKey="PARENT-A"
            sessionKey={1}
          />
        </QueryClientProvider>
      );
    });

    selected = {
      ticketKey: "SIDE-B",
      parentKey: "PARENT-B",
      sessionKey: 2,
    };
    store.activateSession(2, "SIDE-B");
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <DetailHarness
            sideKey="SIDE-B"
            parentKey="PARENT-B"
            sessionKey={2}
          />
        </QueryClientProvider>
      );
      for (let index = 0; index < 5; index += 1) await Promise.resolve();
    });

    sideA.resolve(makeTicket("SIDE-A"));
    await act(async () => {
      for (let index = 0; index < 5; index += 1) await Promise.resolve();
    });

    expect(
      window.localStorage.getItem("sc:lastSeenAt:tenant-1:SIDE-A")
    ).toBeNull();
    expect(
      window.localStorage.getItem("sc:lastSeenAt:tenant-1:SIDE-B")
    ).toBe("1000");

    act(() => root.unmount());
    container.remove();
  });

  it("does not replay detail side effects for unrelated renders with a stable selected-session callback", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    selected = {
      ticketKey: "SIDE-1",
      parentKey: "PARENT-1",
      sessionKey: 1,
    };
    store.activateSession(1, "SIDE-1");
    const detail = {
      sideKey: "SIDE-1",
      recipientLabel: "Vendor",
      subject: "Konu",
      lifecycle: "open" as const,
      solved: false,
      reopenable: false,
      messages: [],
      latestRelevantExternalAt: null,
    };
    client.setQueryData(["side-conversation", "tenant-1", "SIDE-1"], detail);
    const invalidate = jest
      .spyOn(client, "invalidateQueries")
      .mockResolvedValue();
    const getSelectedConversation = () => selected;

    function DetailHarness({ renderCount }: { renderCount: number }) {
      useSideConversationDetailQuery(
        "tenant-1",
        "SIDE-1",
        "PARENT-1",
        1,
        store,
        getSelectedConversation
      );
      return <span>{renderCount}</span>;
    }

    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <DetailHarness renderCount={0} />
        </QueryClientProvider>
      );
      await Promise.resolve();
    });
    expect(invalidate).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <DetailHarness renderCount={1} />
        </QueryClientProvider>
      );
      await Promise.resolve();
    });
    expect(invalidate).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    container.remove();
  });

  it("recomputes the first-unseen scroll target when cached detail is reopened", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    selected = {
      ticketKey: "SIDE-1",
      parentKey: "PARENT-1",
      sessionKey: 1,
    };
    store.activateSession(1, "SIDE-1");
    client.setQueryData(["side-conversation", "tenant-1", "SIDE-1"], {
      sideKey: "SIDE-1",
      recipientLabel: "Vendor",
      subject: "Konu",
      lifecycle: "open" as const,
      solved: false,
      reopenable: false,
      messages: [
        {
          id: "comment-1",
          direction: "incoming" as const,
          body: "<p>İlk</p>",
          status: "sent" as const,
          createdAt: 1_000,
          internal: false,
        },
        {
          id: "comment-2",
          direction: "own" as const,
          body: "<p>Son</p>",
          status: "sent" as const,
          createdAt: 2_000,
          internal: false,
        },
      ],
      latestRelevantExternalAt: 1_000,
    });
    jest.spyOn(client, "invalidateQueries").mockResolvedValue();
    const getSelectedConversation = () => selected;

    function DetailHarness({ sessionKey }: { sessionKey: number }) {
      useSideConversationDetailQuery(
        "tenant-1",
        "SIDE-1",
        "PARENT-1",
        sessionKey,
        store,
        getSelectedConversation
      );
      return null;
    }

    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <DetailHarness sessionKey={1} />
        </QueryClientProvider>
      );
      await Promise.resolve();
    });
    expect(store.consumeScrollRequest(1, "SIDE-1")).toBe("comment-1");
    expect(
      window.localStorage.getItem("sc:lastSeenAt:tenant-1:SIDE-1")
    ).toBe("1000");

    selected = { ...selected, sessionKey: 2 };
    store.activateSession(2, "SIDE-1");
    await act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <DetailHarness sessionKey={2} />
        </QueryClientProvider>
      );
      await Promise.resolve();
    });

    expect(mockedGetTicket).not.toHaveBeenCalled();
    expect(store.consumeScrollRequest(2, "SIDE-1")).toBe("comment-2");

    act(() => root.unmount());
    container.remove();
  });

  it("passes the exact reply request, accepts the transport once, then awaits exact list/detail convergence", async () => {
    const envelope = replyEnvelope();
    const listRefresh = deferred<void>();
    const detailRefresh = deferred<void>();
    mockedPatchTicket.mockResolvedValue({ key: "SIDE-1" });
    client.setQueryData(["side-conversation", "tenant-1", "SIDE-1"], {
      sideKey: "SIDE-1",
      recipientLabel: "Vendor",
      subject: "Konu",
      solved: false,
      messages: [
        {
          id: "comment-10",
          direction: "own",
          body: envelope.request.comment.body,
          status: "sent",
          createdAt: envelope.startedAt + 1,
          senderEmail: "agent@example.test",
          internal: false,
        },
      ],
      latestRelevantExternalAt: null,
    });
    const invalidate = jest
      .spyOn(client, "invalidateQueries")
      .mockReturnValue(listRefresh.promise);
    const refetch = jest
      .spyOn(client, "refetchQueries")
      .mockReturnValue(detailRefresh.promise);

    const mutation = executeReplyMutation(client, boundary(), envelope);
    for (let index = 0; index < 10; index += 1) {
      await Promise.resolve();
    }
    expect(mockedPatchTicket).toHaveBeenCalledWith("SIDE-1", envelope.request);
    expect(mockedPatchTicket.mock.calls[0][1]).toBe(envelope.request);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["side-conversations", "tenant-1", "PARENT-1"],
      exact: true,
      refetchType: "all",
    });
    expect(refetch).not.toHaveBeenCalled();
    expect(store.getOverlayMessages(1, "SIDE-1")[0].status).toBe("sent");

    listRefresh.resolve();
    await Promise.resolve();
    expect(refetch).toHaveBeenCalledWith(
      {
        queryKey: ["side-conversation", "tenant-1", "SIDE-1"],
        exact: true,
        type: "all",
      },
      { throwOnError: true }
    );
    expect(store.getOverlayMessages(1, "SIDE-1")[0].status).toBe("sent");

    detailRefresh.resolve();
    await mutation;
    expect(store.getOverlayMessages(1, "SIDE-1")).toEqual([]);
  });

  it("performs zero invalidation or refetch on failure and keeps the retry envelope", async () => {
    const envelope = replyEnvelope();
    mockedPatchTicket.mockRejectedValue(new NetworkError(new Error("offline")));
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const refetch = jest.spyOn(client, "refetchQueries");

    await expect(
      executeReplyMutation(client, boundary(), envelope)
    ).rejects.toBeInstanceOf(NetworkError);

    expect(invalidate).not.toHaveBeenCalled();
    expect(refetch).not.toHaveBeenCalled();
    expect(store.getRetryEnvelope(envelope.clientMessageId)).toBe(envelope);
    expect(store.getOverlayMessages(1, "SIDE-1")[0]).toMatchObject({
      status: "failed",
      errorKind: "network",
    });
  });

  it("never converts an accepted reply into a resendable failure when canonical refresh fails", async () => {
    const envelope = replyEnvelope();
    mockedPatchTicket.mockResolvedValue({ key: "SIDE-1" });
    jest.spyOn(client, "invalidateQueries").mockResolvedValue();
    jest
      .spyOn(client, "refetchQueries")
      .mockRejectedValue(new Error("detail refresh failed"));

    await expect(
      executeReplyMutation(client, boundary(), envelope)
    ).resolves.toBeUndefined();

    expect(mockedPatchTicket).toHaveBeenCalledTimes(1);
    expect(store.getOverlayMessages(1, "SIDE-1")[0]).toMatchObject({
      status: "sent",
      errorKind: undefined,
    });
  });

  it("binds a created side key before exact refresh and ignores stale A success after B selection", async () => {
    selected = { ticketKey: null, parentKey: "PARENT-1", sessionKey: 1 };
    const create = store.startNew({
      tenantId: "tenant-1",
      parentKey: "PARENT-1",
      sessionKey: 1,
      recipientLabel: "Vendor",
      subject: "Konu",
      body: "<p>Merhaba</p>",
      request: {
        comment: {
          body: "<p>Merhaba</p>",
          publicVisible: true,
          creator: [{ key: "us.email", value: "agent@example.test" }],
        },
        fields: [],
      },
    });
    const response = deferred<Ticket>();
    mockedCreateTicket.mockReturnValue(response.promise);
    const invalidate = jest
      .spyOn(client, "invalidateQueries")
      .mockResolvedValue();

    const mutation = executeCreateMutation(client, boundary(), create);
    selected = { ticketKey: "SIDE-B", parentKey: "PARENT-B", sessionKey: 2 };
    store.activateSession(2, "SIDE-B");
    response.resolve(makeTicket("SIDE-A"));
    await mutation;

    expect(selected.ticketKey).toBe("SIDE-B");
    expect(invalidate).not.toHaveBeenCalled();
    expect(store.getOverlayMessages(2, "SIDE-B")).toEqual([]);
  });

  it("keeps solve/reopen non-optimistic and requests focus only after canonical OPEN detail", async () => {
    store.activateSession(1, "SIDE-1");
    const reopen = store.reopen({
      tenantId: "tenant-1",
      parentKey: "PARENT-1",
      sideKey: "SIDE-1",
      sessionKey: 1,
      solved: true,
    });
    if (!reopen) throw new Error("reopen envelope missing");
    mockedPatchTicket.mockResolvedValue({ key: "SIDE-1" });
    jest.spyOn(client, "invalidateQueries").mockResolvedValue();
    jest.spyOn(client, "refetchQueries").mockImplementation(async () => {
      client.setQueryData(["side-conversation", "tenant-1", "SIDE-1"], {
        sideKey: "SIDE-1",
        recipientLabel: "Vendor",
        subject: "Konu",
        solved: false,
        messages: [],
        latestRelevantExternalAt: null,
      });
    });

    expect(store.lifecyclePending).toBe("reopen");
    await executeStatusMutation(client, boundary(), reopen);
    expect(store.lifecyclePending).toBeNull();
    expect(store.consumeComposerFocus(1, "SIDE-1")).toBe(true);
  });
});
