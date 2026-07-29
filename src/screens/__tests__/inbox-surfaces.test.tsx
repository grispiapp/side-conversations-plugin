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
      initSubject: jest.fn(),
      getEffectiveParentKey: jest.fn(() => "PARENT-1"),
      submit: jest.fn(),
      reset: jest.fn(),
    },
    activeConversation: {},
    panelNavigation: {
      selectedConversation: null,
      bindCreatedTicket: jest.fn(),
      requestBack: jest.fn(() => false),
      openPendingConversation: jest.fn(() => ({
        ticketKey: null,
        parentKey: "PARENT-1",
        sessionKey: 1,
      })),
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
            title={<ScreenTitle>Yeni Görüşme</ScreenTitle>}
            subtitle="Alıcı · Konu"
            onBack={jest.fn()}
            backLabel="Görüşme listesine dön"
            trailing={<Button aria-label="Görüşme seçenekleri">Menü</Button>}
          />
          <ScreenContent>İçerik</ScreenContent>
        </Screen>
      );
    });

    const header = container.querySelector("header");
    expect(header?.className).toContain("h-[var(--panel-header-height)]");
    expect(header?.textContent).toContain("Yeni Görüşme");
    expect(header?.textContent).toContain("Alıcı · Konu");
    expect(
      container.querySelector('[aria-label="Görüşme listesine dön"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[aria-label="Görüşme seçenekleri"]')
    ).not.toBeNull();
  });

  it("keeps shell content width-safe and every button variant at least 44px", () => {
    act(() => {
      root.render(
        <Screen data-testid="screen">
          <ScreenHeader title="Yan Görüşmeler" />
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
    container.querySelectorAll("button").forEach((button) => {
      expect(button.className).toContain("min-h-[var(--interactive-target)]");
      expect(button.className).toContain("focus-visible:ring-2");
    });
  });
});

describe("unified compose surface", () => {
  it("uses the shared shell and the same labelled rich editor as reply", () => {
    act(() => root.render(<ComposeScreen />));

    expect(container.querySelector("header")?.textContent).toContain(
      "Yeni Görüşme"
    );
    expect(
      container.querySelector('[aria-label="Yan görüşme listesine dön"]')
    ).not.toBeNull();
    expect(container.textContent).toContain("Alıcı");
    expect(container.textContent).toContain("Konu");
    expect(container.textContent).toContain("Mesaj");
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
      container.querySelector('[aria-label="Yeni görüşme mesajı"]')
    ).not.toBeNull();

    const send = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent?.trim() === "Gönder");
    expect(send?.className).toContain("w-full");
    expect(send?.disabled).toBe(false);
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

    expect(
      container
        .querySelector<HTMLInputElement>('[role="combobox"]')
        ?.getAttribute("aria-controls")
    ).toBe("compose-recipient-options");
    expect(container.textContent).toContain("Aranıyor…");

    mockStore.compose.query = "geçersiz";
    mockCustomersQuery.isFetching = false;
    remountCompose();
    expect(container.textContent).toContain(
      "Geçerli bir e-posta adresi girin."
    );

    mockStore.compose.query = "vendor@example.test";
    remountCompose();
    const input =
      container.querySelector<HTMLInputElement>('[role="combobox"]');
    const freeEmail =
      container.querySelector<HTMLButtonElement>('[role="option"]');
    expect(freeEmail?.textContent).toContain(
      "vendor@example.test adresini kullan"
    );
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
});
