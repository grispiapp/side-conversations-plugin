import { ComposeScreen } from "../compose-screen";
import { act } from "react";
import { Root, createRoot } from "react-dom/client";

const mockCreateMutate = jest.fn();
let mockStore: any;

jest.mock("@/contexts/store-context", () => ({
  useStore: () => mockStore,
}));

jest.mock("@/contexts/grispi-context", () => ({
  useGrispi: () => ({
    tenantId: "tenant-1",
    agentEmail: "agent@example.test",
    ticket: { key: "PARENT-LIVE" },
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
        13
      );
      const returnedEnvelope =
        await mockStore.compose.submit.mock.results[0].value;
      expect(
        mockStore.panelNavigation.showPendingConversation
      ).toHaveBeenCalledWith(13);
      expect(mockCreateMutate).toHaveBeenCalledWith(returnedEnvelope);
    }
  );

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
});
