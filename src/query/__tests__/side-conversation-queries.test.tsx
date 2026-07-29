import { QueryClientProvider } from "@tanstack/react-query";
import { ReactElement, act } from "react";
import { Root, createRoot } from "react-dom/client";

import { grispiAPI } from "@/grispi/client/api";
import { SIDE_CONVERSATION_PARENT_FIELD_KEY } from "@/lib/side-conversation";
import { createTestQueryClient } from "@/query/query-client";
import {
  customerSearchOptions,
  sideConversationDetailOptions,
  sideConversationListOptions,
  useCustomersQuery,
} from "@/query/side-conversation-queries";
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
      getTicket: jest.fn(),
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
const mockedGetTicket = grispiAPI.tickets.getTicket as jest.Mock;
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
