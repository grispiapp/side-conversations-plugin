import { ConversationsListScreen } from "../conversations-list-screen";
import { ReactElement, act } from "react";
import { Root, createRoot } from "react-dom/client";

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
  actionBadge: "yanit-bekleniyor" as const,
  hasUnseen: false,
  lastPublicCommentAt: 1,
  hydrationFailed: false,
});

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

function makeStore(focusKey: string | null = null) {
  return {
    panelNavigation: {
      openCompose: jest.fn(),
      openConversation: jest.fn(),
      consumeListFocusRequest: jest.fn(() => focusKey),
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
    ticket: { key: "PARENT-1" },
    tenantId: "tenant-1",
    loading: false,
  };
});

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

  act(() => rowButton?.click());

  expect(mockStore.panelNavigation.openConversation).toHaveBeenCalledWith(
    "SC-B",
    "PARENT-1",
    "SC-B"
  );
});

it("restores focus to the exact activating row once after rows render", () => {
  mockStore = makeStore("SC-B");

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
  mockStore = makeStore("SC-REMOVED");
  mockListQuery.rows = [row("SC-A")];

  render(<ConversationsListScreen />);

  expect(document.activeElement).toBe(
    container.querySelector('[aria-label="Yeni görüşme başlat"]')
  );
  expect(
    mockStore.panelNavigation.consumeListFocusRequest
  ).toHaveBeenCalledTimes(1);
});

it("derives skeleton, empty, retry and pagination controls from Query state", () => {
  mockListQuery = { ...mockListQuery, isPending: true };
  render(<ConversationsListScreen />);
  expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(0);
  expect(container.textContent).not.toContain("Henüz yan görüşme yok");

  mockListQuery = { ...mockListQuery, isPending: false, rows: [] };
  render(<></>);
  render(<ConversationsListScreen />);
  expect(container.textContent).toContain("Henüz yan görüşme yok");

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

  const retry = Array.from(
    container.querySelectorAll<HTMLButtonElement>("button")
  ).find((button) => button.textContent?.includes("Yeniden dene"));
  act(() => retry?.click());

  expect(mockListQuery.refetch).toHaveBeenCalledTimes(1);
});
