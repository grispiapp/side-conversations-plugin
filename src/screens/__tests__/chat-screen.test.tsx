import { ChatScreen } from "../chat-screen";
import { ReactElement, act } from "react";
import { Root, createRoot } from "react-dom/client";

let mockStore: any;
let mockGrispi: any;

jest.mock("@/contexts/store-context", () => ({
  useStore: () => mockStore,
}));

jest.mock("@/contexts/grispi-context", () => ({
  useGrispi: () => mockGrispi,
}));

let container: HTMLDivElement;
let root: Root;
let scrollIntoViewMock: jest.Mock;

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

function render(ui: ReactElement): void {
  act(() => {
    root.render(ui);
  });
}

function click(label: string): void {
  const labelledControl = container.querySelector<HTMLElement>(
    `[aria-label="${label}"]`
  );
  const control =
    labelledControl ??
    Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (candidate) => candidate.textContent?.trim() === label
    );
  if (!control) throw new Error(`Control not found: ${label}`);
  act(() => control.click());
}

function makeActive(overrides: Record<string, unknown> = {}): any {
  return {
    status: "ready",
    loadError: null,
    ticketKey: "SC-42",
    parentKey: "PARENT-7",
    recipientLabel: "Ada Lovelace <ada@example.test>",
    subject: "Teslimat",
    solved: false,
    messages: [
      {
        id: "comment-1",
        direction: "incoming",
        body: "<p>İlk yanıt</p>",
        status: "sent",
        createdAt: Date.UTC(2026, 6, 28, 10),
        senderName: "Ada Lovelace",
        senderEmail: "ada@example.test",
      },
      {
        id: "comment-2",
        direction: "own",
        body: "<p>Bizden yanıt</p>",
        status: "sent",
        createdAt: Date.UTC(2026, 6, 28, 11),
      },
    ],
    draftHtml: "",
    scrollTargetMessageId: "comment-1",
    lifecyclePending: null,
    lifecycleError: null,
    load: jest.fn(),
    retry: jest.fn(),
    setDraftHtml: jest.fn(),
    sendReply: jest.fn(),
    setSolved: jest.fn(),
    reopen: jest.fn(),
    retryLifecycle: jest.fn(),
    consumeComposerFocus: jest.fn(() => false),
    ...overrides,
  };
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  scrollIntoViewMock = jest.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoViewMock,
  });

  mockStore = {
    activeConversation: makeActive(),
    panelNavigation: {
      requestChatBack: jest.fn(() => false),
      confirmDiscardReplyAndReturnToList: jest.fn(),
    },
  };
  mockGrispi = { agentEmail: "agent@example.test" };
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("ChatScreen", () => {
  it("renders loading and retryable load-error states", () => {
    mockStore.activeConversation = makeActive({ status: "loading" });
    render(<ChatScreen />);
    expect(container.textContent).toContain("Görüşme yükleniyor");

    mockStore.activeConversation = makeActive({
      status: "error",
      loadError: "Görüşme yüklenemedi. Lütfen tekrar deneyin.",
    });
    render(<></>);
    render(<ChatScreen />);
    expect(container.textContent).toContain(
      "Görüşme yüklenemedi. Lütfen tekrar deneyin."
    );

    click("Görüşmeyi tekrar yükle");
    expect(mockStore.activeConversation.load).toHaveBeenCalledWith(
      "SC-42",
      "PARENT-7"
    );
  });

  it("renders the chronological email flow and scrolls its target only once", () => {
    render(<ChatScreen />);

    const messages = Array.from(
      container.querySelectorAll('[data-testid^="thread-message-"]')
    );
    expect(messages).toHaveLength(2);
    expect(messages[0].textContent).toContain(
      "Ada Lovelace <ada@example.test>"
    );
    expect(messages[1].textContent).toContain("Siz");
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);

    render(<ChatScreen />);
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
  });

  it("wires the immutable recipient, sanitized draft, Shift+Enter send, and failed-message retry", () => {
    mockStore.activeConversation = makeActive({
      messages: [
        {
          id: "failed-1",
          direction: "own",
          body: "<p>Yanıt</p>",
          status: "failed",
          errorKind: "server",
          createdAt: Date.UTC(2026, 6, 28, 11),
        },
      ],
      scrollTargetMessageId: "failed-1",
    });
    render(<ChatScreen />);

    expect(container.textContent).toContain(
      "Yanıt şu kişiye gidecek: Ada Lovelace <ada@example.test>"
    );
    click("Gönderilemedi. Tekrar dene");
    expect(mockStore.activeConversation.retry).toHaveBeenCalledWith("failed-1");

    const editor = container.querySelector<HTMLDivElement>(
      '[role="textbox"][aria-label="Yanıt"]'
    );
    if (!editor) throw new Error("Editor not found");
    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", {
      value: {
        getData: (type: string) =>
          type === "text/html" ? "<p>Yeni yanıt</p>" : "Yeni yanıt",
      },
    });
    act(() => editor.dispatchEvent(paste));
    expect(mockStore.activeConversation.setDraftHtml).toHaveBeenCalledWith(
      "<p>Yeni yanıt</p>"
    );

    act(() =>
      editor.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        })
      )
    );
    expect(mockStore.activeConversation.sendReply).toHaveBeenCalledWith(
      "agent@example.test"
    );
  });

  it("uses the exact solve confirmation and keeps lifecycle failures retryable", () => {
    mockStore.activeConversation = makeActive({
      lifecycleError: { action: "solve", errorKind: "server" },
    });
    render(<ChatScreen />);

    click("Görüşme seçenekleri");
    click("Çözüldü olarak işaretle");
    expect(container.textContent).toContain(
      "Görüşme çözüldü olarak işaretlensin mi? Yeni bir e-posta yanıtı gelirse tekrar aktif olur."
    );
    click("Çözmeyi onayla");
    expect(mockStore.activeConversation.setSolved).toHaveBeenCalledTimes(1);

    expect(container.textContent).toContain("İşlem tamamlanamadı.");
    click("Yaşam döngüsü işlemini tekrar dene");
    expect(mockStore.activeConversation.retryLifecycle).toHaveBeenCalledTimes(
      1
    );
  });

  it("keeps a solved thread mounted, disables reply, and exposes reopen", () => {
    mockStore.activeConversation = makeActive({ solved: true });
    render(<ChatScreen />);

    expect(container.textContent).toContain("Çözüldü");
    expect(
      container.querySelector('[data-testid="thread-message-comment-1"]')
    ).not.toBeNull();
    expect(
      container
        .querySelector('[role="textbox"][aria-label="Yanıt"]')
        ?.getAttribute("aria-disabled")
    ).toBe("true");

    click("Görüşme seçenekleri");
    click("Tekrar aç");
    expect(mockStore.activeConversation.reopen).toHaveBeenCalledTimes(1);
  });

  it("consumes reopen focus and protects a dirty back action", () => {
    mockStore.activeConversation = makeActive({
      consumeComposerFocus: jest.fn(() => true),
    });
    mockStore.panelNavigation.requestChatBack = jest.fn(() => true);
    render(<ChatScreen />);

    const editor = container.querySelector<HTMLElement>(
      '[role="textbox"][aria-label="Yanıt"]'
    );
    expect(
      mockStore.activeConversation.consumeComposerFocus
    ).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(editor);

    click("Görüşme listesine dön");
    expect(container.textContent).toContain("Taslak kaybolacak");
    click("Taslağı sil");
    expect(
      mockStore.panelNavigation.confirmDiscardReplyAndReturnToList
    ).toHaveBeenCalledTimes(1);
  });
});
