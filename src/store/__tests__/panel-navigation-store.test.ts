import { PanelNavigationStore } from "@/store/panel-navigation-store";
import { RootStore } from "@/store/root-store";

// M-2/M-3a (02-06 UAT fix): openCompose() now reaches into
// `rootStore.compose.reset()`, so the stub RootStore needs a `compose` with
// a spyable `reset`. `resetMock` is returned alongside the store so tests
// can assert on call counts without reaching into the stub shape.
function makeStore(): {
  store: PanelNavigationStore;
  resetMock: jest.Mock;
  loadMock: jest.Mock;
  setDraftHtmlMock: jest.Mock;
} {
  const resetMock = jest.fn();
  const loadMock = jest.fn();
  const setDraftHtmlMock = jest.fn();
  const activateSessionMock = jest.fn();
  const rootStore = {
    compose: { reset: resetMock },
    activeConversation: {
      draftHtml: "",
      activateSession: activateSessionMock,
      load: loadMock,
      setDraftHtml: setDraftHtmlMock,
    },
  } as unknown as RootStore;
  return {
    store: new PanelNavigationStore(rootStore),
    resetMock,
    loadMock,
    setDraftHtmlMock,
  };
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

  it("openConversation() synchronously pins a complete session tuple without loading", () => {
    const { store, loadMock } = makeStore();

    store.openConversation("SC-42", "PARENT-7", "row-SC-42");

    expect(store.selectedConversation).toEqual({
      ticketKey: "SC-42",
      parentKey: "PARENT-7",
      sessionKey: 1,
    });
    expect(loadMock).not.toHaveBeenCalled();
    expect(store.screen).toBe("chat");
  });

  it("keeps the later rapid selection as one unmixed tuple with a new session", () => {
    const { store, loadMock } = makeStore();

    store.openConversation("SC-A", "PARENT-A", "row-A");
    store.openConversation("SC-B", "PARENT-B", "row-B");

    expect(store.selectedConversation).toEqual({
      ticketKey: "SC-B",
      parentKey: "PARENT-B",
      sessionKey: 2,
    });
    expect(loadMock).not.toHaveBeenCalled();
  });

  it("opens and binds a pending create session without allowing stale binding", () => {
    const { store } = makeStore();

    const pending = store.openPendingConversation("PARENT-1");
    expect(pending).toEqual({
      ticketKey: null,
      parentKey: "PARENT-1",
      sessionKey: 1,
    });

    store.openPendingConversation("PARENT-2");
    store.bindCreatedTicket(1, "SIDE-STALE");
    expect(store.selectedConversation?.ticketKey).toBeNull();

    store.bindCreatedTicket(2, "SIDE-2");
    expect(store.selectedConversation).toEqual({
      ticketKey: "SIDE-2",
      parentKey: "PARENT-2",
      sessionKey: 2,
    });
  });

  it("requestChatBack() returns to the list immediately for an empty reply draft", () => {
    const { store } = makeStore();
    store.openConversation("SC-42", "PARENT-7", "row-SC-42");

    const needsConfirm = store.requestChatBack();

    expect(needsConfirm).toBe(false);
    expect(store.screen).toBe("list");
    expect(store.consumeListFocusRequest()).toEqual({
      kind: "row",
      key: "row-SC-42",
    });
    expect(store.consumeListFocusRequest()).toBeNull();
  });

  it("requestChatBack() keeps the thread open for a non-empty reply draft", () => {
    const { store } = makeStore();
    store.openConversation("SC-42", "PARENT-7", "row-SC-42");
    store.rootStore.activeConversation.draftHtml = "<p>Yanıt</p>";

    const needsConfirm = store.requestChatBack();

    expect(needsConfirm).toBe(true);
    expect(store.screen).toBe("chat");
    expect(store.consumeListFocusRequest()).toBeNull();
  });

  it("confirmDiscardReplyAndReturnToList() clears only the reply draft and returns", () => {
    const { store, setDraftHtmlMock, resetMock } = makeStore();
    store.openConversation("SC-42", "PARENT-7", "row-SC-42");

    store.confirmDiscardReplyAndReturnToList();

    expect(setDraftHtmlMock).toHaveBeenCalledWith("");
    expect(resetMock).not.toHaveBeenCalled();
    expect(store.screen).toBe("list");
    expect(store.consumeListFocusRequest()).toEqual({
      kind: "row",
      key: "row-SC-42",
    });
  });

  it("requestBack(false) returns false and goes straight back to list (D-02, empty form)", () => {
    const { store } = makeStore();
    store.openCompose();

    const needsConfirm = store.requestBack(false);

    expect(needsConfirm).toBe(false);
    expect(store.screen).toBe("list");
    expect(store.consumeListFocusRequest()).toEqual({
      kind: "create-action",
    });
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
    expect(store.consumeListFocusRequest()).toEqual({
      kind: "create-action",
    });
  });

  it("restores create-action focus after a compose-origin pending thread", () => {
    const { store } = makeStore();
    store.openConversation("OLD", "PARENT-OLD", "old-row");
    store.openCompose();
    store.openPendingConversation("PARENT-NEW");

    expect(store.requestChatBack()).toBe(false);
    expect(store.consumeListFocusRequest()).toEqual({
      kind: "create-action",
    });
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
