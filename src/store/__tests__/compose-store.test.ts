import { grispiAPI } from "@/grispi/client/api";
import { Customer, CustomerSearchResponse } from "@/types/grispi.type";

import { CustomerVM } from "../compose-store";
import { ComposeStore } from "../compose-store";
import { RootStore } from "../root-store";

jest.mock("@/grispi/client/api", () => ({
  grispiAPI: {
    customers: {
      search: jest.fn(),
    },
  },
}));

const mockedSearch = grispiAPI.customers.search as jest.Mock;

function makeCustomer(overrides: {
  id: number;
  email: string;
  fullName?: string | null;
}): Customer {
  return {
    id: overrides.id,
    email: overrides.email,
    emails: [overrides.email],
    fullName: overrides.fullName ?? null,
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

function makeSearchResponse(
  customers: Array<{ id: number; email: string; fullName?: string | null }>
): CustomerSearchResponse {
  const content = customers.map(makeCustomer);
  return {
    content,
    totalPages: 1,
    totalSize: content.length,
    pageNumber: 0,
    numberOfElements: content.length,
  };
}

/**
 * `jest.advanceTimersByTimeAsync` is unavailable under CRA/react-scripts'
 * bundled Jest 27.5.1 config (legacy fake-timers implementation) — fires
 * the debounce's `setTimeout` synchronously, then flushes the microtask
 * queue a few times so `runSearch`'s single `await` (and any chained
 * `runInAction`) settle before assertions run.
 */
async function advanceDebounceAndFlush(ms: number): Promise<void> {
  jest.advanceTimersByTime(ms);
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("ComposeStore", () => {
  let store: ComposeStore;

  beforeEach(() => {
    jest.useFakeTimers();
    store = new ComposeStore({} as RootStore);
    mockedSearch.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("does not search below the live-enforced 3-character minimum (D-04)", async () => {
    store.setQuery("ab");

    await advanceDebounceAndFlush(SEARCH_DEBOUNCE_MS_FOR_TEST);

    expect(store.searchStatus).toBe("idle");
    expect(store.results).toEqual([]);
    expect(mockedSearch).not.toHaveBeenCalled();
  });

  it("fires a single debounced customers.search call 300ms after a 3+ char query", async () => {
    mockedSearch.mockResolvedValueOnce(makeSearchResponse([]));

    store.setQuery("acme");
    expect(mockedSearch).not.toHaveBeenCalled();

    await advanceDebounceAndFlush(SEARCH_DEBOUNCE_MS_FOR_TEST);

    expect(mockedSearch).toHaveBeenCalledTimes(1);
    expect(mockedSearch).toHaveBeenCalledWith({
      searchTerm: "acme",
      size: 10,
      page: 0,
    });
  });

  it("ignores a stale search response via the generation-guard (race between two queries)", async () => {
    let resolveFirst!: (value: CustomerSearchResponse) => void;
    const firstSearch = new Promise<CustomerSearchResponse>((resolve) => {
      resolveFirst = resolve;
    });

    mockedSearch
      .mockImplementationOnce(() => firstSearch)
      .mockImplementationOnce(() =>
        Promise.resolve(
          makeSearchResponse([
            { id: 2, email: "corp@acme.com", fullName: "Acme Corp" },
          ])
        )
      );

    store.setQuery("acme");
    await advanceDebounceAndFlush(SEARCH_DEBOUNCE_MS_FOR_TEST);

    store.setQuery("acme corp");
    await advanceDebounceAndFlush(SEARCH_DEBOUNCE_MS_FOR_TEST);

    expect(store.searchStatus).toBe("results");
    expect(store.results).toEqual([
      { id: 2, name: "Acme Corp", email: "corp@acme.com" },
    ]);

    // The stale (older) query's response arrives last — must be discarded,
    // never overwriting the newer query's already-applied result.
    resolveFirst(
      makeSearchResponse([{ id: 1, email: "old@acme.com", fullName: "Old" }])
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(store.results).toEqual([
      { id: 2, name: "Acme Corp", email: "corp@acme.com" },
    ]);
  });

  it("sets no-results on a zero-match search", async () => {
    mockedSearch.mockResolvedValueOnce(makeSearchResponse([]));

    store.setQuery("zzzzz");
    await advanceDebounceAndFlush(SEARCH_DEBOUNCE_MS_FOR_TEST);

    expect(store.searchStatus).toBe("no-results");
    expect(store.results).toEqual([]);
  });

  it("degrades a search error to the generic no-results state (T-02-03 — no error body/status is ever captured)", async () => {
    mockedSearch.mockRejectedValueOnce(new Error("boom"));

    store.setQuery("acme");
    await advanceDebounceAndFlush(SEARCH_DEBOUNCE_MS_FOR_TEST);

    expect(store.searchStatus).toBe("no-results");
  });

  it("showFreeEmailRow is true only for a valid, currently-unmatched email (D-05/D-06)", () => {
    store.results = [{ id: 1, name: "Match", email: "match@x.com" }];

    store.query = "match@x.com"; // valid but already present in results
    expect(store.showFreeEmailRow).toBe(false);

    store.query = "new@x.com"; // valid and unmatched
    expect(store.showFreeEmailRow).toBe(true);

    store.query = "not-an-email"; // invalid format
    expect(store.showFreeEmailRow).toBe(false);
  });

  it("selectRecipient sets recipientEmail/recipientLabel, falling back to email when the record has no name (D-06 fallback)", () => {
    const named: CustomerVM = { id: 1, name: "Ada Lovelace", email: "ada@x.com" };
    store.selectRecipient(named);
    expect(store.recipientEmail).toBe("ada@x.com");
    expect(store.recipientLabel).toBe("Ada Lovelace");

    const unnamed: CustomerVM = { id: 2, name: null, email: "noname@x.com" };
    store.selectRecipient(unnamed);
    expect(store.recipientEmail).toBe("noname@x.com");
    expect(store.recipientLabel).toBe("noname@x.com");
  });

  it("selectFreeEmail sets both recipientEmail and recipientLabel to the typed address (D-05)", () => {
    store.selectFreeEmail("free@x.com");
    expect(store.recipientEmail).toBe("free@x.com");
    expect(store.recipientLabel).toBe("free@x.com");
  });

  it("initSubject sets the subject exactly once and never overwrites on a later call (D-09); setSubject always updates freely", () => {
    store.initSubject("[DESTEK-1] Kargo sorunu");
    expect(store.subject).toBe("[DESTEK-1] Kargo sorunu");

    store.initSubject("[DESTEK-2] Başka konu");
    expect(store.subject).toBe("[DESTEK-1] Kargo sorunu");

    store.setSubject("Temsilcinin düzenlediği konu");
    expect(store.subject).toBe("Temsilcinin düzenlediği konu");
  });

  describe("isDirty", () => {
    it("is false for an untouched form and stays false after only a prefill", () => {
      expect(store.isDirty).toBe(false);

      store.initSubject("[DESTEK-1] Kargo sorunu");
      expect(store.isDirty).toBe(false);
    });

    it("is true once a recipient is selected", () => {
      store.selectFreeEmail("vendor@example.com");
      expect(store.isDirty).toBe(true);
    });

    it("is true once a message is typed", () => {
      store.setMessage("merhaba");
      expect(store.isDirty).toBe(true);
    });

    it("is true once the subject is edited away from its prefill", () => {
      store.initSubject("[DESTEK-1] Kargo sorunu");
      expect(store.isDirty).toBe(false);

      store.setSubject("Değiştirilmiş konu");
      expect(store.isDirty).toBe(true);
    });
  });

  describe("submit (COMP-04)", () => {
    let startNewMock: jest.Mock;
    let openChatMock: jest.Mock;

    beforeEach(() => {
      startNewMock = jest.fn();
      openChatMock = jest.fn();
      const rootStore = {
        activeConversation: { startNew: startNewMock },
        panelNavigation: { openChat: openChatMock },
      } as unknown as RootStore;
      store = new ComposeStore(rootStore);
    });

    function fillValidForm(): void {
      store.selectFreeEmail("vendor@example.com");
      store.setSubject("[DESTEK-1] Kargo sorunu");
      store.setMessage("Merhaba, kargo durumu nedir?");
    }

    it("D-17: a second submit() call before the first await resolves is a no-op", async () => {
      fillValidForm();

      const first = store.submit("agent@grispi.com", "DESTEK-1");
      const second = store.submit("agent@grispi.com", "DESTEK-1"); // synchronous — before the first call's await yields

      await Promise.all([first, second]);

      expect(startNewMock).toHaveBeenCalledTimes(1);
    });

    it("D-10: does not start a send when recipient or message is empty", async () => {
      store.setSubject("konu");
      store.setMessage("");
      await store.submit("agent@grispi.com", "DESTEK-1");
      expect(startNewMock).not.toHaveBeenCalled();
      expect(store.submitting).toBe(false);

      store.selectFreeEmail("vendor@example.com");
      store.setMessage("   "); // whitespace-only
      await store.submit("agent@grispi.com", "DESTEK-1");
      expect(startNewMock).not.toHaveBeenCalled();
    });

    it("builds the CreateTicketRequest per the confirmed live shape (A1/A4/A5, Pitfall #1-#3)", async () => {
      fillValidForm();

      await store.submit("agent@grispi.com", "DESTEK-1");

      expect(startNewMock).toHaveBeenCalledTimes(1);
      const call = startNewMock.mock.calls[0][0];
      expect(call.parentKey).toBe("DESTEK-1");
      expect(call.request).toEqual({
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
      });
    });

    it("ts.subject key is always present even when the subject was left empty (Pitfall #1, D-10 non-blocking)", async () => {
      store.selectFreeEmail("vendor@example.com");
      store.setMessage("Merhaba");
      // subject intentionally left empty

      await store.submit("agent@grispi.com", "DESTEK-1");

      const call = startNewMock.mock.calls[0][0];
      const subjectField = call.request.fields.find(
        (f: { key: string }) => f.key === "ts.subject"
      );
      expect(subjectField).toEqual({ key: "ts.subject", value: "" });
    });

    it("navigates to chat and resets the whole form after a successful submit", async () => {
      fillValidForm();

      await store.submit("agent@grispi.com", "DESTEK-1");

      expect(openChatMock).toHaveBeenCalledTimes(1);
      expect(store.recipientEmail).toBe("");
      expect(store.recipientLabel).toBe("");
      expect(store.subject).toBe("");
      expect(store.message).toBe("");
      expect(store.submitting).toBe(false);
    });
  });
});

// Named for readability at call sites above — matches ComposeStore's
// internal 300ms debounce window (SEARCH_DEBOUNCE_MS, not exported).
const SEARCH_DEBOUNCE_MS_FOR_TEST = 300;
