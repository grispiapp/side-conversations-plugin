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

function makeAgentCreator(id: number): Ticket["comments"][number]["creator"] {
  return {
    id,
    email: `agent${id}@grispi.com`,
    role: { authority: "ROLE_ADMIN", impliedAuthorities: [], teamUser: true },
  } as unknown as Ticket["comments"][number]["creator"];
}

function makeExternalCreator(
  id: number,
  email: string
): Ticket["comments"][number]["creator"] {
  return {
    id,
    email,
    role: {
      authority: "ROLE_END_USER",
      impliedAuthorities: [],
      teamUser: false,
    },
  } as unknown as Ticket["comments"][number]["creator"];
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

  it("derives per-ticket badges and returns rows grouped+sorted per D-08", async () => {
    mockedAdvancedSearch.mockResolvedValue({
      content: [
        { key: "CLOSED-1", subject: "Kapali konu", status: { id: 5, name: "Closed" } },
        { key: "WAITING-1", subject: "Bekleyen konu", status: { id: 1, name: "Open" } },
        { key: "NEW-1", subject: "Yeni konu", status: { id: 1, name: "Open" } },
      ],
      totalPages: 1,
      totalSize: 3,
      pageNumber: 0,
      numberOfElements: 3,
    });

    mockedGetTicket.mockImplementation((key: string) => {
      if (key === "CLOSED-1") {
        // Solved/Closed short-circuits to "kapali" regardless of who wrote last.
        return Promise.resolve(
          makeTicket({
            key,
            comments: [
              makeComment({
                createdAt: 1000,
                publicVisible: true,
                creator: makeExternalCreator(1, "ext1@example.com"),
              }),
            ],
          })
        );
      }
      if (key === "WAITING-1") {
        // Agent replied last -> "yanit-bekleniyor".
        return Promise.resolve(
          makeTicket({
            key,
            comments: [
              makeComment({
                createdAt: 2000,
                publicVisible: true,
                creator: makeExternalCreator(2, "ext2@example.com"),
              }),
              makeComment({
                createdAt: 3000,
                publicVisible: true,
                creator: makeAgentCreator(9),
              }),
              // Internal note authored by the agent AFTER the last public
              // comment — must be ignored (D-06), or this would wrongly
              // still read as "agent last" anyway; use it to prove the
              // publicVisible filter, not the ordering.
              makeComment({
                createdAt: 4000,
                publicVisible: false,
                creator: makeAgentCreator(9),
              }),
            ],
          })
        );
      }
      // NEW-1: external wrote last -> "yeni-yanit" (no seen record exists).
      return Promise.resolve(
        makeTicket({
          key,
          comments: [
            makeComment({
              createdAt: 5000,
              publicVisible: true,
              creator: makeAgentCreator(9),
            }),
            makeComment({
              createdAt: 9000,
              publicVisible: true,
              creator: makeExternalCreator(3, "ext3@example.com"),
            }),
          ],
        })
      );
    });

    await store.load("PARENT-1");

    expect(store.status).toBe("ready");
    expect(
      store.rows.map((row) => ({ key: row.key, badge: row.badge }))
    ).toEqual([
      { key: "NEW-1", badge: "yeni-yanit" },
      { key: "WAITING-1", badge: "yanit-bekleniyor" },
      { key: "CLOSED-1", badge: "kapali" },
    ]);
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
