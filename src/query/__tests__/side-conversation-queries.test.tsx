import { grispiAPI } from "@/grispi/client/api";
import { SIDE_CONVERSATION_PARENT_FIELD_KEY } from "@/lib/side-conversation";
import { createTestQueryClient } from "@/query/query-client";
import {
  customerSearchOptions,
  sideConversationDetailOptions,
  sideConversationListOptions,
} from "@/query/side-conversation-queries";
import {
  AdvancedSearchResponse,
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
  },
}));

const mockedAdvancedSearch = grispiAPI.tickets.advancedSearch as jest.Mock;
const mockedGetTicket = grispiAPI.tickets.getTicket as jest.Mock;
const mockedCustomerSearch = grispiAPI.customers.search as jest.Mock;

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

function makeCustomerPage(): CustomerSearchResponse {
  return {
    content: [],
    totalPages: 1,
    totalSize: 0,
    pageNumber: 0,
    numberOfElements: 0,
  };
}

describe("side-conversation query contracts", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("defines a page-size-10 infinite list with exact tenant key and page progression", async () => {
    const firstPage = makeListPage(0, 2);
    mockedAdvancedSearch.mockResolvedValue(firstPage);
    const options = sideConversationListOptions("tenant-1", "TICKET-1");
    const client = createTestQueryClient();

    await client.fetchInfiniteQuery(options);

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
    expect(
      options.getNextPageParam(firstPage, [firstPage], 0, [0])
    ).toBe(1);
    expect(
      options.getNextPageParam(
        makeListPage(1, 2),
        [firstPage, makeListPage(1, 2)],
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
});
