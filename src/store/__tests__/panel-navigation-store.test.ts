import { PanelNavigationStore } from "@/store/panel-navigation-store";
import { RootStore } from "@/store/root-store";

// M-2/M-3a (02-06 UAT fix): openCompose() now reaches into
// `rootStore.compose.reset()`, so the stub RootStore needs a `compose` with
// a spyable `reset`. `resetMock` is returned alongside the store so tests
// can assert on call counts without reaching into the stub shape.
function makeStore(): { store: PanelNavigationStore; resetMock: jest.Mock } {
  const resetMock = jest.fn();
  const rootStore = {
    compose: { reset: resetMock },
  } as unknown as RootStore;
  return { store: new PanelNavigationStore(rootStore), resetMock };
}

describe("PanelNavigationStore", () => {
  it("starts on the list screen", () => {
    const { store } = makeStore();
    expect(store.screen).toBe("list");
  });

  it("openCompose() moves to the compose screen", () => {
    const { store } = makeStore();
    store.openCompose();
    expect(store.screen).toBe("compose");
  });

  it("openCompose() resets the compose store before showing it, guaranteeing a pristine draft on every fresh open (M-2/M-3a)", () => {
    const { store, resetMock } = makeStore();

    store.openCompose();

    expect(resetMock).toHaveBeenCalledTimes(1);
    expect(store.screen).toBe("compose");
  });

  it("openChat() moves to the chat screen", () => {
    const { store } = makeStore();
    store.openChat();
    expect(store.screen).toBe("chat");
  });

  it("requestBack(false) returns false and goes straight back to list (D-02, empty form)", () => {
    const { store } = makeStore();
    store.openCompose();

    const needsConfirm = store.requestBack(false);

    expect(needsConfirm).toBe(false);
    expect(store.screen).toBe("list");
  });

  it("requestBack(true) returns true and does NOT change the screen (D-02, dirty form requires confirm)", () => {
    const { store } = makeStore();
    store.openCompose();

    const needsConfirm = store.requestBack(true);

    expect(needsConfirm).toBe(true);
    expect(store.screen).toBe("compose");
  });

  it("confirmDiscardAndReturnToList() moves to the list screen", () => {
    const { store } = makeStore();
    store.openCompose();
    store.confirmDiscardAndReturnToList();
    expect(store.screen).toBe("list");
  });

  it("handleParentTicketChanged(false) while composing closes silently to list (D-03, empty draft)", () => {
    const { store } = makeStore();
    store.openCompose();

    const result = store.handleParentTicketChanged(false);

    expect(result).toBe("closed-silently");
    expect(store.screen).toBe("list");
  });

  it("handleParentTicketChanged(true) while composing needs confirm and stays on compose (D-03, dirty draft)", () => {
    const { store } = makeStore();
    store.openCompose();

    const result = store.handleParentTicketChanged(true);

    expect(result).toBe("needs-confirm");
    expect(store.screen).toBe("compose");
  });

  it("handleParentTicketChanged(...) is a no-op when not composing", () => {
    const { store } = makeStore();

    expect(store.handleParentTicketChanged(true)).toBe("no-op");
    expect(store.screen).toBe("list");

    store.openChat();
    expect(store.handleParentTicketChanged(false)).toBe("no-op");
    expect(store.screen).toBe("chat");
  });
});
