import { ComposeStore, CustomerVM } from "../compose-store";
import { RootStore } from "../root-store";

import { grispiAPI } from "@/grispi/client/api";

jest.mock("@/grispi/client/api", () => ({
  grispiAPI: {
    customers: {
      search: jest.fn(),
    },
  },
}));

const mockedSearch = grispiAPI.customers.search as jest.Mock;

function makeStore(): {
  store: ComposeStore;
  startNew: jest.Mock;
  openChat: jest.Mock;
} {
  const startNew = jest.fn();
  const openChat = jest.fn();
  const rootStore = {
    activeConversation: { startNew },
    panelNavigation: { openChat },
  } as unknown as RootStore;
  return { store: new ComposeStore(rootStore), startNew, openChat };
}

describe("ComposeStore draft ownership", () => {
  beforeEach(() => mockedSearch.mockReset());

  it("stores typed recipient input without timers, results or customer transport", () => {
    jest.useFakeTimers();
    const { store } = makeStore();

    store.setQuery("  Acme ");
    jest.advanceTimersByTime(1000);

    expect(store.query).toBe("  Acme ");
    expect(mockedSearch).not.toHaveBeenCalled();
    expect(store).not.toHaveProperty("results");
    expect(store).not.toHaveProperty("searchStatus");
    jest.useRealTimers();
  });

  it("owns selected matched and free-form recipients", () => {
    const { store } = makeStore();
    const named: CustomerVM = {
      id: 1,
      name: "Ada Lovelace",
      email: "ada@example.test",
    };

    store.selectRecipient(named);
    expect(store.recipientEmail).toBe("ada@example.test");
    expect(store.recipientLabel).toBe("Ada Lovelace");

    store.selectFreeEmail("free@example.test");
    expect(store.recipientEmail).toBe("free@example.test");
    expect(store.recipientLabel).toBe("free@example.test");
  });

  it("keeps untouched prefill clean and detects recipient, message and subject edits", () => {
    const { store } = makeStore();
    store.initSubject("[PARENT-1] Konu", "PARENT-1");
    expect(store.isDirty).toBe(false);

    store.setMessage("Merhaba");
    expect(store.isDirty).toBe(true);

    store.reset();
    store.initSubject("[PARENT-1] Konu", "PARENT-1");
    store.setSubject("Düzenlenen konu");
    expect(store.isDirty).toBe(true);
  });

  it("submits the selected recipient and message to the pinned parent", async () => {
    const { store, startNew, openChat } = makeStore();
    store.initSubject("[PARENT-1] Konu", "PARENT-1");
    store.selectFreeEmail("vendor@example.test");
    store.setMessage("Merhaba");

    await store.submit("agent@example.test", "PARENT-CHANGED");

    expect(startNew).toHaveBeenCalledWith({
      recipientLabel: "vendor@example.test",
      subject: "[PARENT-1] Konu",
      body: "Merhaba",
      parentKey: "PARENT-1",
      request: {
        comment: {
          body: "Merhaba",
          publicVisible: true,
          creator: [{ key: "us.email", value: "agent@example.test" }],
        },
        fields: [
          { key: "ts.subject", value: "[PARENT-1] Konu" },
          { key: "ts.requester", value: ":vendor@example.test" },
          { key: "tu.side_conversation_parent", value: "PARENT-1" },
        ],
      },
    });
    expect(openChat).toHaveBeenCalledTimes(1);
    expect(store.isDirty).toBe(false);
  });

  it("keeps the synchronous submit reentrancy guard and required fields", async () => {
    const { store, startNew } = makeStore();
    store.selectFreeEmail("vendor@example.test");
    store.setMessage("Merhaba");

    const first = store.submit("agent@example.test", "PARENT-1");
    const second = store.submit("agent@example.test", "PARENT-1");
    await Promise.all([first, second]);
    expect(startNew).toHaveBeenCalledTimes(1);

    store.reset();
    await store.submit("agent@example.test", "PARENT-1");
    expect(startNew).toHaveBeenCalledTimes(1);
  });

  it("reset clears the pinned parent so the next draft uses its live parent", async () => {
    const { store, startNew } = makeStore();
    store.initSubject("[PARENT-1]", "PARENT-1");
    store.reset();
    store.selectFreeEmail("vendor@example.test");
    store.setMessage("Merhaba");

    await store.submit("agent@example.test", "PARENT-2");

    expect(startNew.mock.calls[0][0].parentKey).toBe("PARENT-2");
  });
});
