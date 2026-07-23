import { grispiAPI } from "@/grispi/client/api";
import { AdvancedSearchResponse, Ticket } from "@/types/grispi.type";

import { RootStore } from "../root-store";
import { SideConversationsStore } from "../side-conversations-store";

jest.mock("@/grispi/client/api", () => ({
  grispiAPI: {
    tickets: {
      advancedSearch: jest.fn(),
      getTicket: jest.fn(),
    },
  },
}));

const mockedAdvancedSearch = grispiAPI.tickets.advancedSearch as jest.Mock;
const mockedGetTicket = grispiAPI.tickets.getTicket as jest.Mock;

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    key: "DESTEK-1",
    callMergeStatus: null,
    channel: "EMAIL",
    form: {} as Ticket["form"],
    createdAt: 0,
    updatedAt: 0,
    solvedAt: null,
    comments: [],
    fieldMap: {},
    relation: [],
    resolution: null,
    ...overrides,
  };
}

function makeComment(
  overrides: Partial<Ticket["comments"][number]> = {}
): Ticket["comments"][number] {
  return {
    attachments: [],
    id: 1,
    body: "",
    publicVisible: true,
    ticketKey: "DESTEK-1",
    createdAt: 0,
    creator: {} as Ticket["comments"][number]["creator"],
    call: null,
    toId: null,
    toEmail: null,
    commentCCs: [],
    mentionedUsers: [],
    channel: "EMAIL",
    externalId: "",
    ...overrides,
  };
}

function makeSearchResponse(
  keys: string[],
  subjects: Record<string, string> = {}
): AdvancedSearchResponse {
  return {
    content: keys.map((key) => ({ key, subject: subjects[key] })),
    totalPages: 1,
    totalSize: keys.length,
    pageNumber: 0,
    numberOfElements: keys.length,
  };
}

describe("SideConversationsStore", () => {
  let store: SideConversationsStore;

  beforeEach(() => {
    store = new SideConversationsStore({} as RootStore);
    mockedAdvancedSearch.mockReset();
    mockedGetTicket.mockReset();
  });

  it("reaches ready with hydrated rows after a successful two-tier fetch", async () => {
    mockedAdvancedSearch.mockResolvedValue(
      makeSearchResponse(["A", "B"], { A: "Konu A", B: "Konu B" })
    );
    mockedGetTicket.mockImplementation((key: string) =>
      Promise.resolve(
        makeTicket({
          key,
          fieldMap: {
            "ts.requester": {
              // CONFIRMED live (Plan 02 / Task 1 probe): value is a user id
              // string, not an email — resolved via the comment creator match.
              value: "1",
              key: "ts.requester",
            },
          },
          comments: [
            makeComment({
              body: `Merhaba ${key}`,
              ticketKey: key,
              createdAt: 1000,
              creator: {
                id: 1,
                email: `${key}@example.com`,
              } as Ticket["comments"][number]["creator"],
            }),
          ],
        })
      )
    );

    await store.load("PARENT-1");

    expect(store.status).toBe("ready");
    expect(store.rows).toHaveLength(2);
    expect(store.rows[0]).toMatchObject({
      key: "A",
      recipientEmail: "A@example.com",
      subject: "Konu A",
      summary: "Merhaba A",
      lastPublicCommentAt: 1000,
      hydrationFailed: false,
    });
  });

  it("reaches empty when advancedSearch resolves with no content", async () => {
    mockedAdvancedSearch.mockResolvedValue(makeSearchResponse([]));

    await store.load("PARENT-1");

    expect(store.status).toBe("empty");
    expect(store.rows).toHaveLength(0);
  });

  it("discards a stale generation when a newer load starts first", async () => {
    let resolveFirst!: (value: AdvancedSearchResponse) => void;
    const firstSearch = new Promise<AdvancedSearchResponse>((resolve) => {
      resolveFirst = resolve;
    });

    mockedAdvancedSearch
      .mockImplementationOnce(() => firstSearch)
      .mockImplementationOnce(() =>
        Promise.resolve(makeSearchResponse(["B"]))
      );
    mockedGetTicket.mockImplementation((key: string) =>
      Promise.resolve(makeTicket({ key }))
    );

    const firstLoad = store.load("PARENT-OLD");
    const secondLoad = store.load("PARENT-NEW");

    // Resolve the stale (first) search AFTER the second load has already
    // started — simulates the older request's response arriving last.
    resolveFirst(makeSearchResponse(["A"]));

    await Promise.all([firstLoad, secondLoad]);

    expect(store.status).toBe("ready");
    expect(store.rows.map((row) => row.key)).toEqual(["B"]);
  });
});
