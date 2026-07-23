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
    users: {
      getUser: jest.fn(),
    },
  },
}));

const mockedAdvancedSearch = grispiAPI.tickets.advancedSearch as jest.Mock;
const mockedGetTicket = grispiAPI.tickets.getTicket as jest.Mock;
const mockedGetUser = grispiAPI.users.getUser as jest.Mock;

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
  subjects: Record<string, string> = {},
  overrides: Partial<Pick<AdvancedSearchResponse, "totalPages" | "pageNumber">> = {}
): AdvancedSearchResponse {
  return {
    content: keys.map((key) => ({ key, subject: subjects[key] })),
    totalPages: 1,
    totalSize: keys.length,
    pageNumber: 0,
    numberOfElements: keys.length,
    ...overrides,
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
    mockedGetUser.mockReset();
    mockedGetUser.mockResolvedValue(null);
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

  it("silently retries a partially failed hydration and upgrades the row in place (D-11)", async () => {
    mockedAdvancedSearch.mockResolvedValue(
      makeSearchResponse(["A", "B"], { A: "Konu A", B: "Konu B" })
    );

    let hydrationAttemptsForA = 0;
    mockedGetTicket.mockImplementation((key: string) => {
      if (key === "A") {
        hydrationAttemptsForA += 1;
        if (hydrationAttemptsForA === 1) {
          return Promise.reject(new Error("boom"));
        }
        return Promise.resolve(
          makeTicket({
            key: "A",
            comments: [
              makeComment({
                body: "Merhaba A",
                createdAt: 1000,
                creator: makeExternalCreator(1, "a@example.com"),
              }),
            ],
          })
        );
      }
      return Promise.resolve(makeTicket({ key: "B" }));
    });

    await store.load("PARENT-1");

    const rowA = store.rows.find((row) => row.key === "A")!;
    expect(rowA.hydrationFailed).toBe(false);
    expect(rowA.summary).toBe("Merhaba A");
    expect(hydrationAttemptsForA).toBe(2);
  });

  it("leaves a row dimmed (never surfaces as an error) when the silent retry also fails", async () => {
    mockedAdvancedSearch.mockResolvedValue(makeSearchResponse(["A"]));
    mockedGetTicket.mockRejectedValue(new Error("boom"));

    await store.load("PARENT-1");

    expect(store.status).toBe("ready");
    const rowA = store.rows.find((row) => row.key === "A")!;
    expect(rowA.hydrationFailed).toBe(true);
    expect(mockedGetTicket).toHaveBeenCalledTimes(2); // initial attempt + one silent retry
  });

  it("falls back to GET /users/{id} for recipientEmail when no comment-creator matches the requester, and never renders the raw ticket key (LIST-01 gap closure)", async () => {
    mockedAdvancedSearch.mockResolvedValue(makeSearchResponse(["AGENT-ONLY"]));
    mockedGetTicket.mockResolvedValue(
      makeTicket({
        key: "AGENT-ONLY",
        fieldMap: {
          "ts.requester": { key: "ts.requester", value: "92" },
        },
        comments: [
          makeComment({ creator: makeAgentCreator(9), createdAt: 1000 }),
        ],
      })
    );
    mockedGetUser.mockResolvedValueOnce({
      id: 92,
      primaryEmail: "requester@example.com",
    });

    await store.load("PARENT-1");

    const row = store.rows.find((r) => r.key === "AGENT-ONLY")!;
    expect(row.recipientEmail).not.toBe("AGENT-ONLY");
    expect(row.recipientEmail).toBe("requester@example.com");
    expect(mockedGetUser).toHaveBeenCalledWith(92);
  });

  it("keeps a neutral placeholder — never the raw ticket key — when GET /users/{id} also fails", async () => {
    mockedAdvancedSearch.mockResolvedValue(makeSearchResponse(["AGENT-ONLY-2"]));
    mockedGetTicket.mockResolvedValue(
      makeTicket({
        key: "AGENT-ONLY-2",
        fieldMap: {
          "ts.requester": { key: "ts.requester", value: "92" },
        },
        comments: [
          makeComment({ creator: makeAgentCreator(9), createdAt: 1000 }),
        ],
      })
    );
    mockedGetUser.mockRejectedValueOnce(new Error("not found"));

    await store.load("PARENT-1");

    const row = store.rows.find((r) => r.key === "AGENT-ONLY-2")!;
    expect(row.recipientEmail).not.toBe("AGENT-ONLY-2");
    expect(row.recipientEmail).toBe("—");
  });

  describe("loadMore (D-12)", () => {
    it("appends the next page and toggles hasMore off at the last page", async () => {
      mockedAdvancedSearch
        .mockResolvedValueOnce(
          makeSearchResponse(["A"], {}, { totalPages: 2, pageNumber: 0 })
        )
        .mockResolvedValueOnce(
          makeSearchResponse(["B"], {}, { totalPages: 2, pageNumber: 1 })
        );
      mockedGetTicket.mockImplementation((key: string) =>
        Promise.resolve(makeTicket({ key }))
      );

      await store.load("PARENT-1");
      expect(store.hasMore).toBe(true);
      expect(store.rows.map((r) => r.key)).toEqual(["A"]);

      await store.loadMore();

      expect(store.rows.map((r) => r.key)).toEqual(["A", "B"]);
      expect(store.page).toBe(1);
      expect(store.hasMore).toBe(false);
      expect(store.loadingMore).toBe(false);
    });

    it("no-ops when hasMore is false", async () => {
      mockedAdvancedSearch.mockResolvedValue(makeSearchResponse(["A"]));
      mockedGetTicket.mockResolvedValue(makeTicket({ key: "A" }));

      await store.load("PARENT-1");
      expect(store.hasMore).toBe(false);

      await store.loadMore();

      expect(mockedAdvancedSearch).toHaveBeenCalledTimes(1);
    });

    it("discards a stale page append when load() is called mid-loadMore (generation guard)", async () => {
      mockedAdvancedSearch.mockResolvedValueOnce(
        makeSearchResponse(["A"], {}, { totalPages: 2, pageNumber: 0 })
      );
      mockedGetTicket.mockImplementation((key: string) =>
        Promise.resolve(makeTicket({ key }))
      );

      await store.load("PARENT-1");
      expect(store.hasMore).toBe(true);

      let resolveNextPageSearch!: (value: AdvancedSearchResponse) => void;
      const nextPageSearch = new Promise<AdvancedSearchResponse>((resolve) => {
        resolveNextPageSearch = resolve;
      });
      mockedAdvancedSearch.mockImplementationOnce(() => nextPageSearch);
      mockedAdvancedSearch.mockImplementationOnce(() =>
        Promise.resolve(makeSearchResponse(["C"]))
      );

      const loadMorePromise = store.loadMore();
      const newLoadPromise = store.load("PARENT-NEW");

      // The stale loadMore's page-1 search resolves AFTER the newer load()
      // already reset everything for the new ticket — its append must be
      // discarded (Pitfall #6).
      resolveNextPageSearch(makeSearchResponse(["B"]));

      await Promise.all([loadMorePromise, newLoadPromise]);

      expect(store.rows.map((r) => r.key)).toEqual(["C"]);
    });

    it("resets rows/page/hasMore synchronously at load() entry, before the returned promise resolves (D-15)", () => {
      mockedAdvancedSearch.mockImplementation(
        () => new Promise(() => {}) // never resolves — isolates the synchronous reset
      );

      // Seed prior state so the reset is observable.
      store.rows = [{ key: "OLD" } as unknown as (typeof store.rows)[number]];
      store.page = 3;
      store.hasMore = true;
      store.loadingMore = true;
      store.status = "ready";

      // Not awaited on purpose — this checks load()'s synchronous portion.
      void store.load("PARENT-1");

      expect(store.rows).toEqual([]);
      expect(store.page).toBe(0);
      expect(store.hasMore).toBe(false);
      expect(store.loadingMore).toBe(false);
      expect(store.status).toBe("loading");
    });
  });
});
