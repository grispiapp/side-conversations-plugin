import { PanelNavigationStore } from "@/store/panel-navigation-store";
import { RootStore } from "@/store/root-store";

// Same "new Store({} as RootStore)" convention this phase — PanelNavigationStore
// has no cross-store dependency (RESEARCH.md Pattern 5), so a real RootStore
// isn't required to exercise its own transitions.
function makeStore(): PanelNavigationStore {
  return new PanelNavigationStore({} as RootStore);
}

describe("PanelNavigationStore", () => {
  it("starts on the list screen", () => {
    const store = makeStore();
    expect(store.screen).toBe("list");
  });

  it("openCompose() moves to the compose screen", () => {
    const store = makeStore();
    store.openCompose();
    expect(store.screen).toBe("compose");
  });

  it("openChat() moves to the chat screen", () => {
    const store = makeStore();
    store.openChat();
    expect(store.screen).toBe("chat");
  });

  it("requestBack(false) returns false and goes straight back to list (D-02, empty form)", () => {
    const store = makeStore();
    store.openCompose();

    const needsConfirm = store.requestBack(false);

    expect(needsConfirm).toBe(false);
    expect(store.screen).toBe("list");
  });

  it("requestBack(true) returns true and does NOT change the screen (D-02, dirty form requires confirm)", () => {
    const store = makeStore();
    store.openCompose();

    const needsConfirm = store.requestBack(true);

    expect(needsConfirm).toBe(true);
    expect(store.screen).toBe("compose");
  });

  it("confirmDiscardAndReturnToList() moves to the list screen", () => {
    const store = makeStore();
    store.openCompose();
    store.confirmDiscardAndReturnToList();
    expect(store.screen).toBe("list");
  });

  it("handleParentTicketChanged(false) while composing closes silently to list (D-03, empty draft)", () => {
    const store = makeStore();
    store.openCompose();

    const result = store.handleParentTicketChanged(false);

    expect(result).toBe("closed-silently");
    expect(store.screen).toBe("list");
  });

  it("handleParentTicketChanged(true) while composing needs confirm and stays on compose (D-03, dirty draft)", () => {
    const store = makeStore();
    store.openCompose();

    const result = store.handleParentTicketChanged(true);

    expect(result).toBe("needs-confirm");
    expect(store.screen).toBe("compose");
  });

  it("handleParentTicketChanged(...) is a no-op when not composing", () => {
    const store = makeStore();

    expect(store.handleParentTicketChanged(true)).toBe("no-op");
    expect(store.screen).toBe("list");

    store.openChat();
    expect(store.handleParentTicketChanged(false)).toBe("no-op");
    expect(store.screen).toBe("chat");
  });
});
