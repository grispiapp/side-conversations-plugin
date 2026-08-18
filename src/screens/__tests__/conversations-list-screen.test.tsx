import { ConversationsListScreen } from "../conversations-list-screen";
import { ReactElement, act } from "react";
import { Root, createRoot } from "react-dom/client";

import { projectConversationRow } from "@/store/side-conversations-store";
import { SideTicketSummary, Ticket } from "@/types/grispi.type";

let mockStore: any;
let mockGrispi: any;
let mockListQuery: any;

jest.mock("@/contexts/store-context", () => ({
  useStore: () => mockStore,
}));

jest.mock("@/contexts/grispi-context", () => ({
  useGrispi: () => mockGrispi,
}));

jest.mock("@/query/side-conversation-queries", () => ({
  useSideConversationsQuery: () => mockListQuery,
}));

const row = (key: string) => ({
  key,
  recipientEmail: `${key.toLowerCase()}@example.test`,
  requesterId: 1,
  subject: `Subject ${key}`,
  summary: `Summary ${key}`,
  lifecycle: "open" as const,
  actionBadge: "awaiting-reply" as const,
  hasUnseen: false,
  lastPublicCommentAt: 1,
  hydrationFailed: false,
});

function projectedClosedRow() {
  const summary: SideTicketSummary = {
    key: "SC-CLOSED",
    subject: "Closed subject",
    status: { id: 5, name: "Closed" },
  };
  const ticket = {
    key: "SC-CLOSED",
    comments: [],
    fieldMap: {},
  } as unknown as Ticket;
  return projectConversationRow("tenant-1", summary, ticket);
}

let container: HTMLDivElement;
let root: Root;

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

function makeStore(
  focusTarget:
    { kind: "row"; key: string } | { kind: "create-action" } | null = null
) {
  return {
    panelNavigation: {
      openCompose: jest.fn(),
      openConversation: jest.fn(),
      consumeListFocusRequest: jest.fn(() => focusTarget),
    },
  };
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mockStore = makeStore();
  mockListQuery = {
    rows: [row("SC-A"), row("SC-B")],
    isPending: false,
    isError: false,
    error: null,
    hasNextPage: false,
    isFetchingNextPage: false,
    refetch: jest.fn(),
    fetchNextPage: jest.fn(),
  };
  mockGrispi = {
    // Hydrated normal ticket (empty fieldMap = not a side conversation).
    // A provisional `{ key }`-only ticket now disables the create button,
    // so the default fixture has to represent a LOADED ticket.
    ticket: { key: "PARENT-1", fieldMap: {} },
    tenantId: "tenant-1",
    environment: "prod",
    loading: false,
  };
});

function sideConversationTicket(parentKey: string | null = "PARENT-9") {
  return {
    key: "SC-ACTIVE",
    fieldMap:
      parentKey === null
        ? {}
        : {
            "tu.side_conversation_parent": {
              key: "tu.side_conversation_parent",
              value: parentKey,
            },
          },
  };
}

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

it("passes the activating row key through the native row button boundary", () => {
  render(<ConversationsListScreen />);

  const rowButton = Array.from(
    container.querySelectorAll<HTMLButtonElement>("button")
  ).find((button) => button.textContent?.includes("Subject SC-B"));
  expect(rowButton?.tagName).toBe("BUTTON");
  expect(rowButton?.className).toContain("min-h-[72px]");

  act(() => rowButton?.click());

  expect(mockStore.panelNavigation.openConversation).toHaveBeenCalledWith(
    "SC-B",
    "PARENT-1",
    "SC-B"
  );
});

it("renders a labelled header action and flush textual queue states", () => {
  mockListQuery.rows = [
    {
      ...row("SC-NEW"),
      hasUnseen: true,
      actionBadge: "new-reply",
      recipientEmail: "a".repeat(80) + "@example.test",
      subject: "S".repeat(120),
      summary: "M".repeat(160),
    },
    {
      ...row("SC-SOLVED"),
      lifecycle: "solved",
      actionBadge: null,
    },
  ];

  render(<ConversationsListScreen />);

  const create = container.querySelector<HTMLButtonElement>(
    '[aria-label="Yeni konuşma başlat"]'
  );
  expect(create?.textContent).toContain("Yeni konuşma");
  expect(container.querySelector('[role="list"]')?.className).toContain(
    "border-y"
  );
  expect(container.querySelectorAll('[role="listitem"]')).toHaveLength(2);
  expect(container.textContent).toContain("Görülmemiş · Yeni yanıt");
  expect(container.textContent).toContain("Çözüldü");

  const firstRow = container.querySelector<HTMLButtonElement>(
    '[role="listitem"] button'
  );
  expect(firstRow?.className).not.toContain("rounded-md");
  expect(
    Array.from(firstRow?.querySelectorAll(".truncate") ?? []).length
  ).toBeGreaterThanOrEqual(3);
});

it("keeps failed hydration silent while preserving the dimmed subject row", () => {
  mockListQuery.rows = [
    {
      ...row("SC-UNKNOWN"),
      hydrationFailed: true,
      actionBadge: null,
    },
  ];

  render(<ConversationsListScreen />);

  const failedRow = container.querySelector<HTMLButtonElement>(
    '[role="listitem"] button'
  );
  expect(failedRow?.textContent).toContain("Subject SC-UNKNOWN");
  expect(failedRow?.textContent).not.toContain("Summary SC-UNKNOWN");
  expect(failedRow?.textContent).not.toContain("Durum alınamadı");
  expect(container.textContent).not.toContain("Yeni yanıt");
  expect(failedRow?.className).toContain("opacity-60");
});

it("renders a status-5 projected row as Kapalı rather than Çözüldü", () => {
  mockListQuery.rows = [projectedClosedRow()];

  render(<ConversationsListScreen />);

  expect(container.textContent).toContain("Kapalı");
  expect(container.textContent).not.toContain("Çözüldü");
});

it("restores focus to the exact activating row once after rows render", () => {
  mockStore = makeStore({ kind: "row", key: "SC-B" });

  render(<ConversationsListScreen />);

  const rowButton = Array.from(
    container.querySelectorAll<HTMLButtonElement>("button")
  ).find((button) => button.textContent?.includes("Subject SC-B"));
  expect(document.activeElement).toBe(rowButton);
  expect(
    mockStore.panelNavigation.consumeListFocusRequest
  ).toHaveBeenCalledTimes(1);
});

it("falls back to the labeled header create action when the activating row disappeared", () => {
  mockStore = makeStore({ kind: "row", key: "SC-REMOVED" });
  mockListQuery.rows = [row("SC-A")];

  render(<ConversationsListScreen />);

  expect(document.activeElement).toBe(
    container.querySelector('[aria-label="Yeni konuşma başlat"]')
  );
  expect(
    mockStore.panelNavigation.consumeListFocusRequest
  ).toHaveBeenCalledTimes(1);
});

it("focuses the create action for a compose-origin return", () => {
  mockStore = makeStore({ kind: "create-action" });

  render(<ConversationsListScreen />);

  expect(document.activeElement).toBe(
    container.querySelector('[aria-label="Yeni konuşma başlat"]')
  );
});

it("derives skeleton, empty, retry and pagination controls from Query state", () => {
  mockListQuery = { ...mockListQuery, isPending: true };
  render(<ConversationsListScreen />);
  expect(
    container.querySelector('[role="status"][aria-label*="yükleniyor"]')
  ).not.toBeNull();
  expect(container.textContent).not.toContain("Henüz yan konuşma yok");

  mockListQuery = { ...mockListQuery, isPending: false, rows: [] };
  render(<></>);
  render(<ConversationsListScreen />);
  expect(container.textContent).toContain("Henüz yan konuşma yok");

  mockListQuery = {
    ...mockListQuery,
    rows: [row("SC-A")],
    hasNextPage: true,
  };
  render(<></>);
  render(<ConversationsListScreen />);
  const loadMore = container.querySelector<HTMLButtonElement>(
    '[aria-label="Daha fazla yükle"]'
  );
  act(() => loadMore?.click());
  expect(mockListQuery.fetchNextPage).toHaveBeenCalledTimes(1);
});

it("delegates surfaced Query errors to the retry action", () => {
  mockListQuery = {
    ...mockListQuery,
    rows: [],
    isError: true,
    error: null,
  };

  render(<ConversationsListScreen />);
  expect(container.querySelector('[role="alert"]')).not.toBeNull();

  const retry = Array.from(
    container.querySelectorAll<HTMLButtonElement>("button")
  ).find((button) => button.textContent?.includes("Yeniden dene"));
  act(() => retry?.click());

  expect(mockListQuery.refetch).toHaveBeenCalledTimes(1);
});

describe("D-11 — active ticket is itself a side conversation", () => {
  it("does not show the banner and behaves normally when the ticket is not a side conversation", () => {
    render(<ConversationsListScreen />);

    expect(container.textContent).not.toContain("Bu talep bir yan konuşma");
    expect(container.querySelector('[role="list"]')).not.toBeNull();
  });

  it("shows the banner and hides the conversation list when the active ticket is a side conversation", () => {
    mockGrispi.ticket = sideConversationTicket("PARENT-9");

    render(<ConversationsListScreen />);

    expect(container.textContent).toContain("Bu talep bir yan konuşma");
    expect(container.querySelector('[role="list"]')).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.textContent).not.toContain("Henüz yan konuşma yok");
  });

  it("keeps the new-conversation button in the DOM but disabled, with an explanatory accessible name, and blocks the click", () => {
    mockGrispi.ticket = sideConversationTicket("PARENT-9");

    render(<ConversationsListScreen />);

    const button = container.querySelector<HTMLButtonElement>(
      '[aria-label="Yeni konuşma başlatılamaz — bu talep zaten bir yan konuşma"]'
    );
    expect(button).not.toBeNull();
    expect(button?.disabled).toBe(true);

    act(() => button?.click());
    expect(mockStore.panelNavigation.openCompose).not.toHaveBeenCalled();
  });

  it("hides the banner but DISABLES create for the provisional (field-map-less) switchTicket ticket, then shows both once hydrated", () => {
    mockGrispi.ticket = { key: "SC-ACTIVE" };

    render(<ConversationsListScreen />);
    // Banner fails closed by staying absent — we cannot prove the claim yet.
    expect(container.textContent).not.toContain("Bu talep bir yan konuşma");
    // Button fails closed by staying DISABLED. Leaving it enabled here let a
    // fast click through the hydration window open a nested side
    // conversation, which D-11 forbids (live UAT bypass, 2026-08-17).
    // The label stays the normal one: the blocked label is a claim about the
    // ticket, and during hydration that claim is not yet provable.
    expect(
      container.querySelector<HTMLButtonElement>(
        '[aria-label="Yeni konuşma başlat"]'
      )?.disabled
    ).toBe(true);

    mockGrispi.ticket = sideConversationTicket("PARENT-9");
    render(<></>);
    render(<ConversationsListScreen />);

    expect(container.textContent).toContain("Bu talep bir yan konuşma");
    expect(
      container.querySelector<HTMLButtonElement>(
        '[aria-label="Yeni konuşma başlatılamaz — bu talep zaten bir yan konuşma"]'
      )?.disabled
    ).toBe(true);
  });

  it("keeps the new-conversation button's visible text collapsible at narrow width while the accessible name stays full", () => {
    render(<ConversationsListScreen />);

    const button = container.querySelector<HTMLButtonElement>(
      '[aria-label="Yeni konuşma başlat"]'
    );
    const label = button?.querySelector("span");
    expect(label?.className).toContain("min-[320px]:inline");
    expect(button?.getAttribute("aria-label")).toBe("Yeni konuşma başlat");
  });
});

describe("ParentBanner (UX-03, D-11)", () => {
  it("shows the parent key as a neutral chip and a real deep link CTA", () => {
    mockGrispi.ticket = sideConversationTicket("PARENT-9");

    render(<ConversationsListScreen />);

    expect(container.textContent).toContain("üst talep");
    expect(container.textContent).toContain("PARENT-9");
    const cta = Array.from(
      container.querySelectorAll<HTMLAnchorElement>("a")
    ).find((a) => a.textContent?.includes("Üst talebe git"));
    expect(cta?.getAttribute("target")).toBe("_blank");
    expect(cta?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(cta?.getAttribute("href")).toContain("PARENT-9");
  });

  it("shows informational copy but no link when tenantId/environment are unresolved", () => {
    mockGrispi.ticket = sideConversationTicket("PARENT-9");
    mockGrispi.tenantId = null;
    mockGrispi.environment = null;

    render(<ConversationsListScreen />);

    expect(container.textContent).toContain("Bu talep bir yan konuşma");
    const cta = Array.from(
      container.querySelectorAll<HTMLAnchorElement>("a")
    ).find((a) => a.textContent?.includes("Üst talebe git"));
    expect(cta).toBeUndefined();
  });

  it("never renders an alert role or destructive tone", () => {
    mockGrispi.ticket = sideConversationTicket("PARENT-9");

    render(<ConversationsListScreen />);

    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector(".text-destructive")).toBeNull();
  });
});
