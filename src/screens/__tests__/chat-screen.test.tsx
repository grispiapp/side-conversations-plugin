import { ChatScreen } from "../chat-screen";
import { ReactElement, act } from "react";
import { Root, createRoot } from "react-dom/client";

import { buildAgentTicketUrl } from "@/grispi/client/environment";
import { MutationEnvelope } from "@/store/active-conversation-store";

let mockStore: any;
let mockGrispi: any;
let mockDetail: any;
let mockCreateMutation: any;
let mockReplyMutation: any;
let mockStatusMutation: any;

const mockUseDetail = jest.fn();
const mockGetInfoBoxSeen = jest.fn();
const mockSetInfoBoxSeen = jest.fn();

jest.mock("@/contexts/store-context", () => ({
  useStore: () => mockStore,
}));

jest.mock("@/contexts/grispi-context", () => ({
  useGrispi: () => mockGrispi,
}));

// Task 3 (D-16b): the real localStorage-backed store is Plan 04's own
// concern — this screen's tests only assert the CALL contract (tenant-scoped
// seen check + one dismiss write) against a mocked store.
jest.mock("@/lib/info-box-store", () => ({
  getInfoBoxSeen: (tenantId: string) => mockGetInfoBoxSeen(tenantId),
  setInfoBoxSeen: (tenantId: string) => mockSetInfoBoxSeen(tenantId),
}));

jest.mock("@/query/side-conversation-queries", () => ({
  useSideConversationDetailQuery: (
    tenantId: unknown,
    sideKey: unknown,
    parentKey: unknown,
    sessionKey: unknown,
    activeConversation: unknown,
    getSelectedConversation: unknown
  ) =>
    mockUseDetail(
      tenantId,
      sideKey,
      parentKey,
      sessionKey,
      activeConversation,
      getSelectedConversation
    ),
  useCreateSideConversationMutation: () => mockCreateMutation,
  useReplySideConversationMutation: () => mockReplyMutation,
  useStatusSideConversationMutation: () => mockStatusMutation,
}));

let container: HTMLDivElement;
let root: Root;
let scrollIntoViewMock: jest.Mock;

function envelope(
  kind: "create" | "reply" | "solve" | "reopen",
  clientMessageId = `msg-${kind}`
): MutationEnvelope {
  const common = {
    clientMessageId,
    tenantId: "tenant-1",
    parentKey: "PARENT-7",
    sessionKey: 8,
    startedAt: 10_000,
  };
  if (kind === "create") {
    return {
      ...common,
      kind,
      request: {
        comment: {
          body: "<p>Yeni</p>",
          publicVisible: true,
          creator: [{ key: "us.email", value: "agent@example.test" }],
        },
        fields: [],
      },
    };
  }
  if (kind === "reply") {
    return {
      ...common,
      kind,
      sideKey: "SC-42",
      request: {
        comment: {
          body: "<p>Yanıt</p>",
          publicVisible: true,
          creator: [{ key: "us.email", value: "agent@example.test" }],
        },
      },
    };
  }
  return {
    ...common,
    kind,
    sideKey: "SC-42",
    request: {
      fields: [{ key: "ts.status", value: kind === "solve" ? "4" : "2" }],
    },
  };
}

function canonicalMessages() {
  return [
    {
      id: "comment-1",
      direction: "incoming",
      body: "<p>İlk yanıt</p>",
      status: "sent",
      createdAt: 1_000,
      senderName: "Ada",
      senderEmail: "ada@example.test",
      internal: false,
    },
  ];
}

function makeDetail(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      sideKey: "SC-42",
      recipientLabel: "Ada <ada@example.test>",
      subject: "Teslimat",
      lifecycle: "open",
      solved: false,
      reopenable: false,
      messages: canonicalMessages(),
      latestRelevantExternalAt: 1_000,
    },
    isPending: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    dataUpdatedAt: 1,
    ...overrides,
  };
}

function makeActive(overrides: Record<string, unknown> = {}) {
  return {
    draftHtml: "",
    lifecyclePending: null,
    lifecycleError: null,
    activateSession: jest.fn(),
    setDraftHtml: jest.fn(),
    setAuthoredDraftHtml: jest.fn(),
    sendReply: jest.fn(() => envelope("reply")),
    setSolved: jest.fn(() => envelope("solve")),
    reopen: jest.fn(() => envelope("reopen")),
    retryLifecycle: jest.fn(() => envelope("solve")),
    getRetryEnvelope: jest.fn(),
    mergeCanonical: jest.fn(
      (_sessionKey: number, _sideKey: string, messages: unknown[]) => messages
    ),
    getOverlayMessages: jest.fn(() => []),
    getLocalPresentation: jest.fn(() => null),
    consumeScrollRequest: jest.fn(() => "comment-1"),
    consumeComposerFocus: jest.fn(() => false),
    ...overrides,
  };
}

function render(ui: ReactElement): void {
  act(() => root.render(ui));
}

function click(label: string): void {
  const labelled = container.querySelector<HTMLElement>(
    `[aria-label="${label}"]`
  );
  const control =
    labelled ??
    Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (candidate) => candidate.textContent?.trim() === label
    );
  if (!control) throw new Error(`Control not found: ${label}`);
  act(() => control.click());
}

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  scrollIntoViewMock = jest.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoViewMock,
  });

  mockDetail = makeDetail();
  mockCreateMutation = { mutate: jest.fn(), status: "idle" };
  mockReplyMutation = { mutate: jest.fn(), status: "idle" };
  mockStatusMutation = { mutate: jest.fn(), status: "idle" };
  mockStore = {
    activeConversation: makeActive(),
    // COMP-05/THRD-05 (Plan 05): RichTextComposer's reply usage reads
    // attachment chip state through this store — the mock must expose the
    // same shape as the real AttachmentUploadStore.
    attachmentUpload: {
      chips: jest.fn(() => []),
      isUploading: jest.fn(() => false),
      addFiles: jest.fn(() => []),
      removeChip: jest.fn(),
      retryChip: jest.fn(),
      collectAttachmentIds: jest.fn(() => []),
      reset: jest.fn(),
    },
    panelNavigation: {
      selectedConversation: {
        ticketKey: "SC-42",
        parentKey: "PARENT-7",
        sessionKey: 8,
      },
      bindCreatedTicket: jest.fn(),
      requestChatBack: jest.fn(() => false),
      confirmDiscardReplyAndReturnToList: jest.fn(),
    },
  };
  mockGrispi = {
    tenantId: "tenant-1",
    agentEmail: "agent@example.test",
    agentName: "Destek Temsilcisi",
    environment: "preprod",
  };
  mockUseDetail.mockReset();
  mockUseDetail.mockImplementation(() => mockDetail);
  mockGetInfoBoxSeen.mockReset();
  mockGetInfoBoxSeen.mockReturnValue(false);
  mockSetInfoBoxSeen.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("ChatScreen Query-owned session wiring", () => {
  it("reads canonical detail only from the exact tenant and selected tuple", () => {
    render(<ChatScreen />);

    expect(mockUseDetail).toHaveBeenCalledWith(
      "tenant-1",
      "SC-42",
      "PARENT-7",
      8,
      mockStore.activeConversation,
      expect.any(Function)
    );
    expect(container.textContent).toContain("Ada <ada@example.test>");
    expect(container.textContent).toContain("Konu: Teslimat");
    expect(container.querySelector("header")?.className).toContain(
      "h-[var(--panel-header-height)]"
    );
    expect(container.textContent).toContain("İlk yanıt");
    expect(
      container.querySelector<HTMLButtonElement>(
        'button[aria-label="Yanıt gönder"]'
      )
    ).not.toBeNull();
    expect(mockStore.activeConversation.mergeCanonical).toHaveBeenCalledWith(
      8,
      "SC-42",
      mockDetail.data.messages
    );
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the selected-session callback stable across ordinary local renders", () => {
    render(<ChatScreen />);
    const firstSelector = mockUseDetail.mock.calls[0][5];

    click("Konuşma seçenekleri");

    const latestCall = mockUseDetail.mock.calls.at(-1);
    expect(latestCall?.[5]).toBe(firstSelector);
  });

  it("renders Query loading/error and retries only the exact detail query", () => {
    mockDetail = makeDetail({ data: undefined, isPending: true });
    render(<ChatScreen />);
    expect(container.textContent).toContain("Konuşma yükleniyor");

    const refetch = jest.fn();
    mockDetail = makeDetail({
      data: undefined,
      isPending: false,
      isError: true,
      refetch,
    });
    render(<></>);
    render(<ChatScreen />);
    expect(container.textContent).toContain("Konuşma yüklenemedi");
    click("Konuşmayı tekrar yükle");
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("builds replies locally and executes the returned envelope through Query", () => {
    const reply = envelope("reply");
    mockStore.activeConversation.sendReply.mockReturnValue(reply);
    render(<ChatScreen />);

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

    expect(mockStore.activeConversation.sendReply).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      parentKey: "PARENT-7",
      sideKey: "SC-42",
      sessionKey: 8,
      agentEmail: "agent@example.test",
      solved: false,
      attachmentIds: [],
    });
    expect(mockReplyMutation.mutate).toHaveBeenCalledWith(reply);
    expect(mockStore.attachmentUpload.reset).toHaveBeenCalledWith("reply");
  });

  it("strips pasted quote history before reply submission", () => {
    render(<ChatScreen />);

    const editor = container.querySelector<HTMLDivElement>(
      '[role="textbox"][aria-label="Yanıt"]'
    );
    if (!editor) throw new Error("Editor not found");
    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", {
      value: {
        getData: (type: string) =>
          type === "text/html"
            ? '<p>New reply</p><blockquote data-sc-authored-quote="true"><p>Old history</p></blockquote><p>Trailing history</p>'
            : "New reply\nOld history\nTrailing history",
      },
    });
    act(() => editor.dispatchEvent(paste));
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

    const submittedHtml =
      mockStore.activeConversation.setAuthoredDraftHtml.mock.calls.at(-1)?.[0];
    expect(submittedHtml).toContain("<p>New reply</p>");
    expect(submittedHtml).not.toMatch(
      /Old history|Trailing history|data-sc-authored-quote/
    );
    expect(mockStore.activeConversation.sendReply).toHaveBeenCalledTimes(1);
  });

  it("routes failed retries through the matching hook with exact envelope identity", () => {
    const create = envelope("create", "failed-create");
    const reply = envelope("reply", "failed-reply");
    mockStore.activeConversation.getRetryEnvelope.mockImplementation(
      (id: string) => (id === "failed-create" ? create : reply)
    );
    mockStore.activeConversation.mergeCanonical.mockReturnValue([
      {
        id: "failed-create",
        direction: "own",
        body: "<p>Create</p>",
        status: "failed",
        createdAt: 10_000,
        errorKind: "network",
      },
      {
        id: "failed-reply",
        direction: "own",
        body: "<p>Reply</p>",
        status: "failed",
        createdAt: 11_000,
        errorKind: "server",
      },
    ]);
    render(<ChatScreen />);

    const retries = container.querySelectorAll<HTMLButtonElement>(
      '[aria-label="Gönderilemedi. Tekrar dene"]'
    );
    act(() => retries[0].click());
    act(() => retries[1].click());
    expect(mockCreateMutation.mutate).toHaveBeenCalledWith(create);
    expect(mockReplyMutation.mutate).toHaveBeenCalledWith(reply);
  });

  it("continues a new compose submission as a pending first outbound email block", () => {
    mockStore.panelNavigation.selectedConversation = {
      ticketKey: null,
      parentKey: "PARENT-7",
      sessionKey: 8,
    };
    mockDetail = makeDetail({ data: undefined });
    mockStore.activeConversation.getLocalPresentation.mockReturnValue({
      recipientLabel: "Vendor <vendor@example.test>",
      subject: "Yeni sipariş",
    });
    mockStore.activeConversation.getOverlayMessages.mockReturnValue([
      {
        id: "pending-create",
        direction: "own",
        body: "<p>İlk e-posta</p>",
        status: "pending",
        createdAt: 10_000,
      },
    ]);

    render(<ChatScreen />);

    expect(container.textContent).toContain("Vendor <vendor@example.test>");
    expect(container.textContent).toContain("Konu: Yeni sipariş");
    expect(container.textContent).toContain("İlk e-posta");
    expect(
      container.querySelector('[role="status"][aria-label="Gönderiliyor"]')
    ).not.toBeNull();
  });

  it("manages lifecycle menu focus, keyboard dismissal and outside dismissal", () => {
    render(<ChatScreen />);

    const trigger = container.querySelector<HTMLButtonElement>(
      '[aria-label="Konuşma seçenekleri"]'
    );
    expect(trigger?.getAttribute("aria-haspopup")).toBe("menu");

    click("Konuşma seçenekleri");
    // Menü açılış odağı artık türetilmiş sıranın ilk öğesini (Yenile) hedef
    // alıyor — bu test o sözleşmeyi sabitliyor.
    const item =
      container.querySelector<HTMLButtonElement>('[role="menuitem"]');
    expect(item?.textContent).toBe("Yenile");
    expect(document.activeElement).toBe(item);
    expect(item?.className).toContain("min-h-11");

    act(() => {
      item?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        })
      );
    });
    expect(container.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    click("Konuşma seçenekleri");
    act(() => {
      document.body.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true })
      );
    });
    expect(container.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    click("Konuşma seçenekleri");
    const tabItem =
      container.querySelector<HTMLButtonElement>('[role="menuitem"]');
    act(() => {
      tabItem?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Tab",
          bubbles: true,
          cancelable: true,
        })
      );
    });
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });

  it("keeps lifecycle canonical and executes solve/reopen/retry envelopes through Query", () => {
    const solve = envelope("solve");
    mockStore.activeConversation.setSolved.mockReturnValue(solve);
    render(<ChatScreen />);
    click("Konuşma seçenekleri");
    click("Çözüldü olarak işaretle");
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.activeElement?.textContent).toBe("Vazgeç");
    expect(container.textContent).not.toContain("Çözmeyi onayla");
    click("Çözüldü olarak işaretle");
    expect(mockStatusMutation.mutate).toHaveBeenCalledWith(solve);
    expect(container.textContent).not.toContain("ÇözüldüTekrar");

    const reopen = envelope("reopen");
    mockDetail = makeDetail({
      data: {
        ...makeDetail().data,
        lifecycle: "solved",
        solved: true,
        reopenable: true,
      },
    });
    mockStore.activeConversation.reopen.mockReturnValue(reopen);
    render(<></>);
    render(<ChatScreen />);
    expect(
      container.querySelector('[role="textbox"][aria-label="Yanıt"]')
    ).toBeNull();
    expect(container.textContent).not.toContain("Yanıt şu kişiye gidecek:");
    expect(container.textContent).toContain(
      "Yanıt yazmak için konuşmayı tekrar açın."
    );
    click("Tekrar aç");
    expect(mockStatusMutation.mutate).toHaveBeenCalledWith(reopen);

    mockStatusMutation.mutate.mockClear();
    click("Konuşma seçenekleri");
    click("Tekrar aç");
    expect(mockStatusMutation.mutate).toHaveBeenCalledWith(reopen);
  });

  it("keeps status-5 closed detail terminal and non-editable", () => {
    mockDetail = makeDetail({
      data: {
        ...makeDetail().data,
        lifecycle: "closed",
        solved: true,
        reopenable: false,
      },
    });

    render(<ChatScreen />);

    expect(container.textContent).toContain("Kapalı");
    // The menu trigger stays ENABLED on a closed conversation (2026-08-17
    // live UAT): parent navigation lives in it now, and navigating away is
    // not an edit. "Terminal" is enforced by the lifecycle item being
    // absent, asserted below — not by locking the whole menu.
    const closedMenuTrigger = container.querySelector<HTMLButtonElement>(
      '[aria-label="Konuşma seçenekleri"]'
    );
    expect(closedMenuTrigger?.disabled).toBe(false);
    act(() => closedMenuTrigger?.click());
    expect(
      container.querySelector('[aria-label="Tekrar aç"]')
    ).toBeNull();
    expect(
      container.querySelector('[aria-label="Çözüldü olarak işaretle"]')
    ).toBeNull();
    expect(
      container.querySelector('[aria-label="Üst talebe git: PARENT-7"]')
    ).not.toBeNull();
    act(() => closedMenuTrigger?.click());
    expect(
      container.querySelector('[role="textbox"][aria-label="Yanıt"]')
    ).toBeNull();
    expect(container.textContent).toContain("Bu konuşma kapalı.");
    expect(
      Array.from(container.querySelectorAll("button")).find(
        (control) => control.textContent?.trim() === "Tekrar aç"
      )
    ).toBeUndefined();
  });

  it("traps confirmation focus, makes the background inert, and restores focus", () => {
    render(<ChatScreen />);
    const trigger = container.querySelector<HTMLButtonElement>(
      '[aria-label="Konuşma seçenekleri"]'
    );
    click("Konuşma seçenekleri");
    click("Çözüldü olarak işaretle");

    const dialog = container.querySelector<HTMLElement>('[role="dialog"]');
    const controls = dialog?.querySelectorAll<HTMLButtonElement>("button");
    const cancel = controls?.[0];
    const confirm = controls?.[1];
    expect(document.activeElement).toBe(cancel);
    expect(container.querySelector("header")?.hasAttribute("inert")).toBe(true);

    act(() => {
      cancel?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Tab",
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        })
      );
    });
    expect(document.activeElement).toBe(confirm);

    act(() => {
      confirm?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Tab",
          bubbles: true,
          cancelable: true,
        })
      );
    });
    expect(document.activeElement).toBe(cancel);

    click("Vazgeç");
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector("header")?.hasAttribute("inert")).toBe(
      false
    );
    expect(document.activeElement).toBe(trigger);
  });

  it("uses only matching-session one-shot scroll/focus and preserves dirty back", () => {
    mockStore.activeConversation.consumeComposerFocus.mockReturnValue(true);
    mockStore.panelNavigation.requestChatBack.mockReturnValue(true);
    render(<ChatScreen />);

    expect(
      mockStore.activeConversation.consumeScrollRequest
    ).toHaveBeenCalledWith(8, "SC-42");
    expect(
      mockStore.activeConversation.consumeComposerFocus
    ).toHaveBeenCalledWith(8, "SC-42");
    expect(
      container.querySelector('[role="textbox"][aria-label="Yanıt"]')
    ).toBe(document.activeElement);

    click("Konuşma listesine dön");
    expect(container.textContent).toContain("Taslak kaybolacak");
    click("Taslağı sil");
    expect(
      mockStore.panelNavigation.confirmDiscardReplyAndReturnToList
    ).toHaveBeenCalledTimes(1);
  });
});

describe("ChatScreen refresh menu item (Task 1: manual detail refetch)", () => {
  it("puts Yenile first, calls detail.refetch() exactly once on click, closes the menu and refocuses the trigger", () => {
    const refetch = jest.fn();
    mockDetail = makeDetail({ refetch });
    render(<ChatScreen />);

    const trigger = container.querySelector<HTMLButtonElement>(
      '[aria-label="Konuşma seçenekleri"]'
    );
    click("Konuşma seçenekleri");
    const first =
      container.querySelector<HTMLButtonElement>('[role="menuitem"]');
    expect(first?.textContent).toBe("Yenile");
    expect(first?.getAttribute("aria-label")).toBe("Konuşmayı yenile");

    click("Yenile");
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("disables Yenile and spins the trigger icon while a fetch is in flight, even after the menu closes", () => {
    mockDetail = makeDetail({ isFetching: true });
    render(<ChatScreen />);

    const trigger = container.querySelector<HTMLButtonElement>(
      '[aria-label="Konuşma seçenekleri"]'
    );
    expect(trigger?.querySelector("svg")?.getAttribute("class")).toContain(
      "animate-spin"
    );

    click("Konuşma seçenekleri");
    const yenile = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
    ).find((el) => el.textContent === "Yenile");
    expect(yenile?.disabled).toBe(true);

    act(() => {
      document.body.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true })
      );
    });
    expect(container.querySelector('[role="menu"]')).toBeNull();
    // Feedback survives menu close — the trigger is the only channel left.
    expect(trigger?.querySelector("svg")?.getAttribute("class")).toContain(
      "animate-spin"
    );
  });

  it("shows the static dots icon and an enabled Yenile item once no fetch is in flight", () => {
    render(<ChatScreen />);
    const trigger = container.querySelector<HTMLButtonElement>(
      '[aria-label="Konuşma seçenekleri"]'
    );
    expect(trigger?.querySelector("svg")?.getAttribute("class")).not.toContain(
      "animate-spin"
    );

    click("Konuşma seçenekleri");
    const yenile = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
    ).find((el) => el.textContent === "Yenile");
    expect(yenile?.disabled).toBe(false);
  });

  it("never renders Yenile while sideKey is null (no conversation created yet)", () => {
    mockStore.panelNavigation.selectedConversation = {
      ticketKey: null,
      parentKey: "PARENT-7",
      sessionKey: 8,
    };
    mockDetail = makeDetail({ data: undefined });
    render(<ChatScreen />);

    click("Konuşma seçenekleri");
    expect(
      Array.from(
        container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
      ).some((el) => el.textContent === "Yenile")
    ).toBe(false);
    expect(
      container.querySelector('[aria-label="Üst talebe git: PARENT-7"]')
    ).not.toBeNull();
  });

  it("keeps the trigger enabled and offers Yenile on a closed conversation even without a resolvable parent URL", () => {
    mockStore.panelNavigation.selectedConversation = {
      ticketKey: "SC-42",
      parentKey: null,
      sessionKey: 8,
    };
    mockDetail = makeDetail({
      data: {
        ...makeDetail().data,
        lifecycle: "closed",
        solved: true,
        reopenable: false,
      },
    });
    render(<ChatScreen />);

    const trigger = container.querySelector<HTMLButtonElement>(
      '[aria-label="Konuşma seçenekleri"]'
    );
    expect(trigger?.disabled).toBe(false);

    click("Konuşma seçenekleri");
    expect(
      Array.from(
        container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
      ).map((el) => el.textContent)
    ).toEqual(["Yenile"]);
  });

  it("derives keyboard order from the menu items array: ArrowDown/ArrowUp wrap and Home/End jump across all three items", () => {
    render(<ChatScreen />);
    click("Konuşma seçenekleri");

    const items = Array.from(
      container.querySelectorAll<HTMLElement>('[role="menuitem"]')
    );
    expect(items.map((el) => el.getAttribute("aria-label"))).toEqual([
      "Konuşmayı yenile",
      "Çözüldü olarak işaretle",
      "Üst talebe git: PARENT-7",
    ]);

    act(() => {
      items[0].dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowDown",
          bubbles: true,
          cancelable: true,
        })
      );
    });
    expect(document.activeElement).toBe(items[1]);

    act(() => {
      items[1].dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowDown",
          bubbles: true,
          cancelable: true,
        })
      );
    });
    expect(document.activeElement).toBe(items[2]);

    act(() => {
      items[2].dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowDown",
          bubbles: true,
          cancelable: true,
        })
      );
    });
    expect(document.activeElement).toBe(items[0]);

    act(() => {
      items[0].dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowUp",
          bubbles: true,
          cancelable: true,
        })
      );
    });
    expect(document.activeElement).toBe(items[2]);

    act(() => {
      items[2].dispatchEvent(
        new KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true })
      );
    });
    expect(document.activeElement).toBe(items[0]);

    act(() => {
      items[0].dispatchEvent(
        new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true })
      );
    });
    expect(document.activeElement).toBe(items[2]);
  });
});

describe("ChatScreen header composition (D-06/D-07/D-08/D-10)", () => {
  it("renders the side ticket key as a new-tab link and keeps the recipient out of the header", () => {
    render(<ChatScreen />);

    const header = container.querySelector("header");
    const link = header?.querySelector("a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe(
      buildAgentTicketUrl("tenant-1", "preprod", "SC-42")
    );
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link?.textContent).toContain("SC-42");
    expect(header?.textContent).not.toContain("Ada <ada@example.test>");
  });

  it("renders a plain-text placeholder, never a broken link, while the conversation is pending", () => {
    mockStore.panelNavigation.selectedConversation = {
      ticketKey: null,
      parentKey: "PARENT-7",
      sessionKey: 8,
    };
    mockDetail = makeDetail({ data: undefined });
    render(<ChatScreen />);

    const header = container.querySelector("header");
    expect(header?.querySelector("a")).toBeNull();
    expect(header?.textContent).toContain("Yeni konuşma");
  });

  it("renders no link and does not crash when environment is not yet resolved", () => {
    mockGrispi.environment = null;
    expect(() => render(<ChatScreen />)).not.toThrow();

    const header = container.querySelector("header");
    expect(header?.querySelector("a")).toBeNull();
  });

  it("keeps the parent ticket key out of the cramped header entirely", () => {
    render(<ChatScreen />);

    // 2026-08-17 live UAT: two keys + subject + two buttons did not fit the
    // 48px header and the chip was clipped mid-glyph. The parent key moved
    // into the "..." menu — it is navigated to occasionally, not read
    // constantly. This also removes any chance of confusing the two keys.
    const header = container.querySelector("header");
    expect(header?.textContent).not.toContain("PARENT-7");
    expect(header?.textContent).not.toContain("üst talep");
    // The side ticket's own key is still the header title, still a link.
    expect(header?.querySelector("a")?.textContent).toContain("SC-42");
  });

  it("offers parent navigation in the menu as a new-tab link built from the resolved environment", () => {
    render(<ChatScreen />);

    act(() =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Konuşma seçenekleri"]')
        ?.click()
    );

    const parentLink = container.querySelector<HTMLAnchorElement>(
      '[aria-label="Üst talebe git: PARENT-7"]'
    );
    expect(parentLink?.tagName).toBe("A");
    expect(parentLink?.getAttribute("role")).toBe("menuitem");
    // D-07/D-08: new tab, noopener, host from tenant + resolved environment
    // only — never window.open, never the iframe hash origin.
    expect(parentLink?.target).toBe("_blank");
    expect(parentLink?.rel).toContain("noopener");
    expect(parentLink?.rel).toContain("noreferrer");
    expect(parentLink?.getAttribute("href")).toBe(
      "https://tenant-1.grispi.net/tickets/PARENT-7"
    );
  });

  it("keeps the 'Konu:' prefix and its empty-subject placeholder in the subtitle", () => {
    mockDetail = makeDetail({
      data: { ...makeDetail().data, subject: "" },
    });
    render(<ChatScreen />);

    const header = container.querySelector("header");
    expect(header?.textContent).toContain("Konu: Konu yok");
  });
});

describe("ChatScreen recipient visibility and identity wiring (D-09/D-13/D-14)", () => {
  it("shows the recipient in the solved block, and omits the line entirely when the label is empty", () => {
    mockDetail = makeDetail({
      data: { ...makeDetail().data, lifecycle: "solved", solved: true },
    });
    render(<ChatScreen />);
    expect(container.textContent).toContain("Alıcı: Ada <ada@example.test>");

    mockDetail = makeDetail({
      data: {
        ...makeDetail().data,
        lifecycle: "solved",
        solved: true,
        recipientLabel: "",
      },
    });
    render(<></>);
    render(<ChatScreen />);
    expect(container.textContent).not.toContain("Alıcı:");
  });

  it("shows the recipient line when the conversation is closed too", () => {
    mockDetail = makeDetail({
      data: {
        ...makeDetail().data,
        lifecycle: "closed",
        solved: true,
        reopenable: false,
      },
    });
    render(<ChatScreen />);
    expect(container.textContent).toContain("Alıcı: Ada <ada@example.test>");
  });

  it("keeps the recipient in the composer row (not the solved block) while the conversation is open", () => {
    render(<ChatScreen />);
    expect(
      container.querySelector('[aria-label="Yanıt yazma durumu"]')
    ).toBeNull();
    expect(container.textContent).toContain("Yanıt: Ada <ada@example.test>");
  });

  it("shows the 'Siz' badge only on the active agent's own message", () => {
    mockStore.activeConversation.mergeCanonical.mockReturnValue([
      {
        id: "own-active",
        direction: "own",
        body: "<p>Benim</p>",
        status: "sent",
        createdAt: 1_000,
        senderName: "Agent One",
        senderEmail: "agent@example.test",
      },
      {
        id: "own-other",
        direction: "own",
        body: "<p>Diğer</p>",
        status: "sent",
        createdAt: 2_000,
        senderName: "Agent Two",
        senderEmail: "other-agent@example.test",
      },
    ]);
    render(<ChatScreen />);

    const activeMessage = container.querySelector(
      '[data-testid="thread-message-own-active"]'
    );
    const otherMessage = container.querySelector(
      '[data-testid="thread-message-own-other"]'
    );
    expect(
      activeMessage?.querySelector('[data-testid="sender-badge"]')
    ).not.toBeNull();
    expect(
      otherMessage?.querySelector('[data-testid="sender-badge"]')
    ).toBeNull();
    expect(activeMessage?.textContent).toContain("Agent One");
    expect(otherMessage?.textContent).toContain("Agent Two");
  });

  it("shows the bundled agent name on a still-pending optimistic own message", () => {
    mockGrispi.agentName = "Ada Temsilci";
    mockStore.panelNavigation.selectedConversation = {
      ticketKey: null,
      parentKey: "PARENT-7",
      sessionKey: 8,
    };
    mockDetail = makeDetail({ data: undefined });
    mockStore.activeConversation.getOverlayMessages.mockReturnValue([
      {
        id: "pending-own",
        direction: "own",
        body: "<p>Taslak</p>",
        status: "pending",
        createdAt: 3_000,
      },
    ]);
    render(<ChatScreen />);

    expect(container.textContent).toContain("Ada Temsilci");
  });
});

describe("ChatScreen info box (D-16(b))", () => {
  function reserveCreatedConversation() {
    mockStore.panelNavigation.selectedConversation = {
      ticketKey: null,
      parentKey: "PARENT-7",
      sessionKey: 8,
    };
    mockDetail = makeDetail({ data: undefined });
  }

  it("never shows the info box for a conversation opened from the list", () => {
    render(<ChatScreen />);
    expect(container.textContent).not.toContain(
      "Bu işlem yeni bir talep oluşturur"
    );
  });

  it("shows the info box once a conversation is created in this session, and keeps it through binding", () => {
    reserveCreatedConversation();
    render(<ChatScreen />);
    expect(container.textContent).toContain(
      "Bu işlem yeni bir talep oluşturur"
    );

    mockStore.panelNavigation.selectedConversation = {
      ticketKey: "SC-42",
      parentKey: "PARENT-7",
      sessionKey: 8,
    };
    render(<ChatScreen />);
    expect(container.textContent).toContain(
      "Bu işlem yeni bir talep oluşturur"
    );
  });

  it("does not show the info box when this tenant already dismissed it", () => {
    mockGetInfoBoxSeen.mockReturnValue(true);
    reserveCreatedConversation();
    render(<ChatScreen />);
    expect(container.textContent).not.toContain(
      "Bu işlem yeni bir talep oluşturur"
    );
  });

  it("dismiss calls setInfoBoxSeen once, removes the box, and returns focus to the back button", () => {
    reserveCreatedConversation();
    render(<ChatScreen />);

    click("Bilgi kutusunu kapat");

    expect(mockSetInfoBoxSeen).toHaveBeenCalledTimes(1);
    expect(mockSetInfoBoxSeen).toHaveBeenCalledWith("tenant-1");
    expect(container.textContent).not.toContain(
      "Bu işlem yeni bir talep oluşturur"
    );
    const backButton = container.querySelector<HTMLElement>(
      '[aria-label="Konuşma listesine dön"]'
    );
    expect(backButton).not.toBeNull();
    expect(document.activeElement).toBe(backButton);

    render(<ChatScreen />);
    expect(container.textContent).not.toContain(
      "Bu işlem yeni bir talep oluşturur"
    );
  });

  it("never renders the info box when tenantId is null", () => {
    mockGrispi.tenantId = null;
    reserveCreatedConversation();
    render(<ChatScreen />);
    expect(container.textContent).not.toContain(
      "Bu işlem yeni bir talep oluşturur"
    );
  });
});
