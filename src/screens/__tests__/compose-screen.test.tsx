import { ComposeScreen } from "../compose-screen";
import { InfoBox } from "../components/info-box";
import { act } from "react";
import { Root, createRoot } from "react-dom/client";

const mockCreateMutate = jest.fn();
let mockStore: any;
/** Mutable so a test can hand ComposeScreen a hydrated, branded parent. */
let mockTicket: any;

jest.mock("@/contexts/store-context", () => ({
  useStore: () => mockStore,
}));

jest.mock("@/contexts/grispi-context", () => ({
  useGrispi: () => ({
    tenantId: "tenant-1",
    agentEmail: "agent@example.test",
    ticket: mockTicket,
  }),
}));

jest.mock("@/query/side-conversation-queries", () => ({
  useCreateSideConversationMutation: () => ({ mutate: mockCreateMutate }),
}));

jest.mock("../components/recipient-field", () => ({
  RecipientField: () => <div>Recipient</div>,
}));
jest.mock("../components/subject-field", () => ({
  SubjectField: () => <div>Subject</div>,
}));
jest.mock("../components/message-field", () => ({
  MessageField: ({
    onSubmit,
    submitDisabled,
  }: {
    onSubmit: () => void;
    submitDisabled?: boolean;
  }) => (
    <>
      <button type="button" disabled={submitDisabled} onClick={onSubmit}>
        Gönder
      </button>
      <button type="button" onClick={onSubmit}>
        Shift gönder
      </button>
    </>
  ),
}));

describe("ComposeScreen create mutation wiring", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockCreateMutate.mockReset();
    // Provisional (field-map-less) parent by default — the same shape
    // switchTicket sets before hydration completes.
    mockTicket = { key: "PARENT-LIVE" };
    const createdEnvelope = { kind: "create", clientMessageId: "msg-create" };
    mockStore = {
      compose: {
        recipientEmail: "vendor@example.test",
        message: "<p>Merhaba</p>",
        submitting: false,
        isDirty: true,
        initSubject: jest.fn(),
        getEffectiveParentKey: jest.fn(() => "PARENT-PINNED"),
        submit: jest.fn(async () => createdEnvelope),
        reset: jest.fn(),
      },
      activeConversation: {},
      attachmentUpload: {
        collectAttachmentIds: jest.fn(() => []),
        reset: jest.fn(),
      },
      panelNavigation: {
        requestBack: jest.fn(() => false),
        confirmDiscardAndReturnToList: jest.fn(),
        reservePendingConversation: jest.fn(() => ({
          ticketKey: null,
          parentKey: "PARENT-PINNED",
          sessionKey: 13,
        })),
        showPendingConversation: jest.fn(() => true),
        cancelPendingConversationReservation: jest.fn(),
        selectedConversation: null,
        bindCreatedTicket: jest.fn(),
      },
    };
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function click(label: string): Promise<void> {
    const button = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button")
    ).find((candidate) => candidate.textContent?.trim() === label);
    if (!button) throw new Error(`Button not found: ${label}`);
    await act(async () => {
      button.click();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it.each(["Gönder", "Shift gönder"])(
    "opens a pending selected session and executes the returned envelope via %s",
    async (label) => {
      act(() => root.render(<ComposeScreen />));
      await click(label);

      expect(mockStore.compose.getEffectiveParentKey).toHaveBeenCalledWith(
        "PARENT-LIVE"
      );
      expect(
        mockStore.panelNavigation.reservePendingConversation
      ).toHaveBeenCalledWith("PARENT-PINNED");
      expect(mockStore.compose.submit).toHaveBeenCalledWith(
        "tenant-1",
        "agent@example.test",
        "PARENT-LIVE",
        13,
        [],
        null
      );
      const returnedEnvelope =
        await mockStore.compose.submit.mock.results[0].value;
      expect(
        mockStore.panelNavigation.showPendingConversation
      ).toHaveBeenCalledWith(13);
      expect(mockCreateMutate).toHaveBeenCalledWith(returnedEnvelope);
    }
  );

  it("forwards the hydrated parent's brand id to submit (quick-260902-dhy)", async () => {
    mockTicket = {
      key: "PARENT-LIVE",
      fieldMap: { "ts.brand": { key: "ts.brand", value: "7" } },
    };
    act(() => root.render(<ComposeScreen />));
    await click("Gönder");

    expect(mockStore.compose.submit).toHaveBeenCalledWith(
      "tenant-1",
      "agent@example.test",
      "PARENT-LIVE",
      13,
      [],
      "7"
    );
  });

  it("guards same-tick double submit before reserving a second pending session", async () => {
    let resolveSubmit!: (value: unknown) => void;
    mockStore.compose.submit.mockImplementation(() => {
      mockStore.compose.submitting = true;
      return new Promise((resolve) => {
        resolveSubmit = resolve;
      });
    });

    act(() => root.render(<ComposeScreen />));
    const send = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button")
    ).find((button) => button.textContent?.trim() === "Gönder");
    await act(async () => {
      send?.click();
      send?.click();
      resolveSubmit({ kind: "create", clientMessageId: "msg-create" });
      await Promise.resolve();
    });

    expect(
      mockStore.panelNavigation.reservePendingConversation
    ).toHaveBeenCalledTimes(1);
    expect(mockStore.compose.submit).toHaveBeenCalledTimes(1);
    expect(mockCreateMutate).toHaveBeenCalledTimes(1);
  });

  it("renders the D-17 info-box copy", () => {
    act(() => root.render(<ComposeScreen />));

    expect(container.textContent).toContain(
      "Bu işlem yeni bir talep oluşturur. Alan, atanan ve durum bilgileri otomatik dolmaz; gerekiyorsa talep ekranından manuel ayarlayın."
    );
  });

  it("renders the info box before the recipient field (DOM order, D-16(a))", () => {
    act(() => root.render(<ComposeScreen />));

    const infoParagraph = Array.from(container.querySelectorAll("p")).find(
      (p) => p.textContent?.includes("Bu işlem yeni bir talep oluşturur")
    );
    const recipientNode = Array.from(container.querySelectorAll("div")).find(
      (div) => div.textContent === "Recipient"
    );

    expect(infoParagraph).toBeDefined();
    expect(recipientNode).toBeDefined();
    expect(
      infoParagraph!.compareDocumentPosition(recipientNode!) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("never renders an info-box dismiss button here (D-16(a): persistent)", () => {
    act(() => root.render(<ComposeScreen />));

    expect(
      container.querySelector('button[aria-label="Bilgi kutusunu kapat"]')
    ).toBeNull();
  });
});

describe("InfoBox", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("dismissible=false: shows the D-17 copy and renders no button", () => {
    act(() => root.render(<InfoBox dismissible={false} />));

    expect(container.textContent).toContain(
      "Bu işlem yeni bir talep oluşturur. Alan, atanan ve durum bilgileri otomatik dolmaz; gerekiyorsa talep ekranından manuel ayarlayın."
    );
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("dismissible=true: renders exactly one button with the locked aria-label, calling onDismiss once per click", () => {
    const onDismiss = jest.fn();
    act(() => root.render(<InfoBox dismissible onDismiss={onDismiss} />));

    const buttons = container.querySelectorAll("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0].getAttribute("aria-label")).toBe(
      "Bilgi kutusunu kapat"
    );

    act(() => buttons[0].click());
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("is never a live region (no aria-live, role=status, or role=alert)", () => {
    act(() => root.render(<InfoBox dismissible={false} />));

    expect(container.querySelector("[aria-live]")).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("hides the info icon from the accessibility tree", () => {
    act(() => root.render(<InfoBox dismissible={false} />));

    const icon = container.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon!.getAttribute("aria-hidden")).toBe("true");
  });
});
