import { act } from "react";
import { Root, createRoot } from "react-dom/client";

import { Button } from "@/components/ui/button";
import {
  Screen,
  ScreenContent,
  ScreenHeader,
  ScreenTitle,
} from "@/components/ui/screen";
import { ComposeScreen } from "@/screens/compose-screen";

let container: HTMLDivElement;
let root: Root;
let mockStore: any;
let mockGrispi: any;
let mockCustomersQuery: any;

jest.mock("@/contexts/store-context", () => ({
  useStore: () => mockStore,
}));

jest.mock("@/contexts/grispi-context", () => ({
  useGrispi: () => mockGrispi,
}));

jest.mock("@/query/side-conversation-queries", () => ({
  useCreateSideConversationMutation: () => ({ mutate: jest.fn() }),
  useCustomersQuery: () => mockCustomersQuery,
}));

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mockStore = {
    compose: {
      query: "",
      recipientEmail: "vendor@example.test",
      recipientLabel: "Vendor <vendor@example.test>",
      subject: "[PARENT-1] Tedarik",
      message: "<p>Merhaba</p>",
      submitting: false,
      isDirty: true,
      setQuery: jest.fn(),
      selectFreeEmail: jest.fn(),
      selectRecipient: jest.fn(),
      setSubject: jest.fn(),
      setMessage: jest.fn(),
      setAuthoredMessage: jest.fn(),
      initSubject: jest.fn(),
      getEffectiveParentKey: jest.fn(() => "PARENT-1"),
      submit: jest.fn(),
      reset: jest.fn(),
    },
    activeConversation: {},
    // COMP-05/THRD-05 (Plan 05): RichTextComposer reads attachment chip
    // state through this store for both surfaces — MessageField (this
    // screen's compose surface) now depends on it, so the mock must expose
    // the same shape as the real AttachmentUploadStore.
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
      selectedConversation: null,
      bindCreatedTicket: jest.fn(),
      requestBack: jest.fn(() => false),
      reservePendingConversation: jest.fn(() => ({
        ticketKey: null,
        parentKey: "PARENT-1",
        sessionKey: 1,
      })),
      showPendingConversation: jest.fn(() => true),
      cancelPendingConversationReservation: jest.fn(),
      confirmDiscardAndReturnToList: jest.fn(),
    },
  };
  mockGrispi = {
    tenantId: "tenant-1",
    agentEmail: "agent@example.test",
    ticket: { key: "PARENT-1" },
  };
  mockCustomersQuery = {
    customers: [],
    isDebouncing: false,
    isPending: false,
    isFetching: false,
    isError: false,
    refetch: jest.fn(),
  };
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("shared inbox shell", () => {
  it("uses one semantic 48px header with labelled leading and trailing actions", () => {
    act(() => {
      root.render(
        <Screen>
          <ScreenHeader
            title={<ScreenTitle>Yeni Konuşma</ScreenTitle>}
            subtitle="Alıcı · Konu"
            onBack={jest.fn()}
            backLabel="Konuşma listesine dön"
            trailing={<Button aria-label="Konuşma seçenekleri">Menü</Button>}
          />
          <ScreenContent>İçerik</ScreenContent>
        </Screen>
      );
    });

    const header = container.querySelector("header");
    expect(header?.className).toContain("h-[var(--panel-header-height)]");
    expect(header?.textContent).toContain("Yeni Konuşma");
    expect(header?.textContent).toContain("Alıcı · Konu");
    expect(
      container.querySelector('[aria-label="Konuşma listesine dön"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[aria-label="Konuşma seçenekleri"]')
    ).not.toBeNull();
  });

  it("keeps shell content width-safe with compact, focus-visible actions", () => {
    act(() => {
      root.render(
        <Screen data-testid="screen">
          <ScreenHeader title="Yan Konuşmalar" />
          <ScreenContent data-testid="content">
            <Button>Gönder</Button>
            <Button size="sm">Tekrar dene</Button>
            <Button size="icon" aria-label="Menü" />
          </ScreenContent>
        </Screen>
      );
    });

    expect(
      container.querySelector('[data-testid="screen"]')?.className
    ).toContain("overflow-hidden");
    expect(
      container.querySelector('[data-testid="content"]')?.className
    ).toContain("overflow-x-hidden");
    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons[0].className).toContain("h-[var(--interactive-target)]");
    expect(buttons[1].className).toContain("h-9");
    expect(buttons[2].className).toContain("h-[var(--interactive-target)]");
    buttons.forEach((button) => {
      expect(button.className).toContain("focus-visible:ring-2");
    });
  });
});

describe("unified compose surface", () => {
  it("uses the shared shell and the same labelled rich editor as reply", () => {
    act(() => root.render(<ComposeScreen />));

    expect(container.querySelector("header")?.textContent).toContain(
      "Yeni Konuşma"
    );
    expect(
      container.querySelector('[aria-label="Yan konuşma listesine dön"]')
    ).not.toBeNull();
    expect(container.textContent).toContain("Alıcı");
    expect(container.textContent).toContain("Konu");
    expect(
      container.querySelector(
        '[role="textbox"][aria-label="Mesaj"][aria-required="true"]'
      )
    ).not.toBeNull();
    expect(
      container.querySelector(
        '[role="toolbar"][aria-label="Metin biçimlendirme"]'
      )
    ).not.toBeNull();
    expect(
      container.querySelector('[aria-label="Yeni konuşma mesajı"]')
    ).not.toBeNull();

    const send = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent?.trim() === "Gönder");
    expect(send?.className).toContain("shrink-0");
    expect(send?.disabled).toBe(false);

    const composeSurface = container.querySelector(
      '[aria-label="Yeni konuşma e-postası"]'
    );
    const recipientRow = container.querySelector(
      '[aria-label="Alıcıyı değiştir"]'
    )?.parentElement;
    const recipientName = recipientRow?.querySelector("span.min-w-0.flex-1");
    const subject =
      container.querySelector<HTMLInputElement>("#compose-subject");
    const subjectPrefix = container.querySelector(
      '[aria-label^="Konu ön eki"]'
    );
    const editor = container.querySelector(
      '[role="textbox"][aria-label="Mesaj"]'
    );
    const toolbar = container.querySelector(
      '[role="toolbar"][aria-label="Metin biçimlendirme"]'
    );
    expect(composeSurface?.className).toContain("flex-col");
    expect(recipientRow?.className).toContain("min-h-12");
    expect(recipientRow?.className).not.toContain("border-input");
    expect(recipientName?.className).toContain("text-left");
    expect(recipientName?.textContent).toContain("Vendor");
    expect(subject?.className).toContain("border-0");
    expect(subjectPrefix?.textContent).toBe("[PARENT-1]");
    expect(subject?.value).toBe("Tedarik");
    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      valueSetter?.call(subject, "Yeni konu");
      subject?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(mockStore.compose.setSubject).toHaveBeenCalledWith(
      "[PARENT-1] Yeni konu"
    );
    expect(editor).not.toBeNull();
    expect(toolbar).not.toBeNull();
    expect(
      editor!.compareDocumentPosition(toolbar!) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(send?.closest('[aria-label="Yeni konuşma mesajı"]')).not.toBeNull();
  });

  it("keeps recipient search and invalid compose states labelled and keyboard reachable", () => {
    const remountCompose = () => {
      act(() => root.render(<></>));
      act(() => root.render(<ComposeScreen />));
    };

    mockStore.compose.recipientEmail = "";
    mockStore.compose.recipientLabel = "";
    mockStore.compose.query = "ven";
    mockCustomersQuery.isFetching = true;
    remountCompose();

    const loadingInput =
      container.querySelector<HTMLInputElement>('[role="combobox"]');
    expect(loadingInput?.getAttribute("aria-expanded")).toBe("false");
    expect(loadingInput?.getAttribute("aria-controls")).toBeNull();
    expect(loadingInput?.getAttribute("aria-haspopup")).toBeNull();
    expect(container.textContent).toContain("Aranıyor…");
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(
      container.querySelector('[role="status"]')?.closest('[role="region"]')
    ).not.toBeNull();

    mockStore.compose.query = "Davut";
    mockCustomersQuery.isFetching = false;
    remountCompose();
    expect(container.textContent).toContain("Sonuç bulunamadı");
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(
      container
        .querySelector('[role="combobox"]')
        ?.getAttribute("aria-expanded")
    ).toBe("false");
    expect(container.textContent).not.toContain(
      "Geçerli bir e-posta adresi girin."
    );

    mockStore.compose.query = "geçersiz@";
    remountCompose();
    expect(container.textContent).toContain(
      "Geçerli bir e-posta adresi girin."
    );
    expect(container.querySelector('[role="listbox"]')).toBeNull();

    mockStore.compose.query = "vendor@example.test";
    remountCompose();
    const input =
      container.querySelector<HTMLInputElement>('[role="combobox"]');
    const freeEmail =
      container.querySelector<HTMLButtonElement>('[role="option"]');
    expect(input?.getAttribute("aria-controls")).toBe(
      "compose-recipient-options"
    );
    expect(input?.getAttribute("aria-expanded")).toBe("true");
    expect(input?.getAttribute("aria-haspopup")).toBe("listbox");
    expect(freeEmail?.textContent).toContain(
      "vendor@example.test adresini kullan"
    );
    const listbox = container.querySelector('[role="listbox"]');
    expect(listbox).not.toBeNull();
    expect(
      Array.from(listbox?.children ?? []).every(
        (child) => child.getAttribute("role") === "option"
      )
    ).toBe(true);
    act(() => {
      input?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowDown",
          bubbles: true,
          cancelable: true,
        })
      );
    });
    act(() => {
      input?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
        })
      );
    });
    expect(mockStore.compose.selectFreeEmail).toHaveBeenCalledWith(
      "vendor@example.test"
    );

    mockStore.compose.message = "<p><br></p>";
    remountCompose();
    const send = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent?.trim() === "Gönder");
    expect(send?.disabled).toBe(true);
  });

  it("renders a distinct recipient query error with retry and no fallback states", () => {
    mockStore.compose.recipientEmail = "";
    mockStore.compose.recipientLabel = "";
    mockStore.compose.query = "vendor@example.test";
    mockCustomersQuery.isError = true;

    act(() => root.render(<ComposeScreen />));

    expect(container.textContent).toContain("Alıcılar aranamadı.");
    expect(container.textContent).not.toContain("Sonuç bulunamadı");
    expect(container.textContent).not.toContain("adresini kullan");
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    const input =
      container.querySelector<HTMLInputElement>('[role="combobox"]');
    expect(input?.getAttribute("aria-expanded")).toBe("false");
    expect(input?.getAttribute("aria-controls")).toBeNull();
    expect(input?.getAttribute("aria-haspopup")).toBeNull();
    expect(
      container.querySelector('[role="alert"]')?.closest('[role="region"]')
    ).not.toBeNull();
    const retry = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent?.trim() === "Yeniden dene");
    expect(retry?.closest('[role="listbox"]')).toBeNull();
    act(() => retry?.click());
    expect(mockCustomersQuery.refetch).toHaveBeenCalledTimes(1);
  });

  it("explains unavailable recipients and skips them during keyboard selection", () => {
    mockStore.compose.recipientEmail = "";
    mockStore.compose.recipientLabel = "";
    mockStore.compose.query = "Davut";
    const availableCustomer = {
      id: 2,
      name: "Davut Kember",
      email: "davut@example.test",
    };
    mockCustomersQuery.customers = [
      { id: 1, name: "Davut", email: null },
      availableCustomer,
    ];

    act(() => root.render(<ComposeScreen />));

    const input =
      container.querySelector<HTMLInputElement>('[role="combobox"]');
    const unavailable = container.querySelector<HTMLElement>(
      '[role="option"][aria-disabled="true"]'
    );
    expect(unavailable?.textContent).toContain("Davut");
    expect(unavailable?.textContent).toContain("E-posta adresi bulunmuyor");
    expect(unavailable?.tagName).toBe("DIV");

    act(() => unavailable?.click());
    expect(mockStore.compose.selectRecipient).not.toHaveBeenCalled();

    act(() => {
      input?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowDown",
          bubbles: true,
          cancelable: true,
        })
      );
    });
    expect(input?.getAttribute("aria-activedescendant")).toBe(
      "compose-recipient-option-0"
    );
    act(() => {
      input?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
        })
      );
    });
    expect(mockStore.compose.selectRecipient).toHaveBeenCalledWith(
      availableCustomer
    );
  });

  it("dismisses the recipient popup with Escape and when focus leaves the combobox", () => {
    mockStore.compose.recipientEmail = "";
    mockStore.compose.recipientLabel = "";
    mockStore.compose.query = "Davut";
    mockCustomersQuery.customers = [
      { id: 1, name: "Davut", email: "davut@example.test" },
    ];

    act(() => root.render(<ComposeScreen />));
    const input =
      container.querySelector<HTMLInputElement>('[role="combobox"]');
    const recipientPopup = container.querySelector(
      '[role="region"][aria-label="Alıcı arama"]'
    );
    const firstOption =
      container.querySelector<HTMLButtonElement>('[role="option"]');
    expect(input?.getAttribute("aria-expanded")).toBe("true");
    expect(recipientPopup?.className).toContain("inset-x-0");
    expect(recipientPopup?.className).not.toMatch(/left-2|right-2|rounded/);
    expect(firstOption?.className).toContain("min-h-14");

    act(() => {
      input?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        })
      );
    });
    expect(input?.getAttribute("aria-expanded")).toBe("false");
    expect(input?.getAttribute("aria-activedescendant")).toBeNull();

    act(() => input?.focus());
    expect(input?.getAttribute("aria-expanded")).toBe("true");
    const subject =
      container.querySelector<HTMLInputElement>("#compose-subject");
    act(() => subject?.focus());
    expect(input?.getAttribute("aria-expanded")).toBe("false");
  });
});
