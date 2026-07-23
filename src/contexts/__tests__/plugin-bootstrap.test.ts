import { bootstrapPluginInit } from "@/contexts/plugin-bootstrap";
import { grispiAPI } from "@/grispi/client/api";
import { HttpError } from "@/grispi/client/http-handler";
import { RootStore } from "@/store/root-store";
import { GrispiBundle } from "@/types/grispi.type";

// Same jest.mock convention as
// src/store/__tests__/side-conversations-store.test.ts — the STORE-ERROR
// integration test below drives a real SideConversationsStore through this
// mocked API surface.
jest.mock("@/grispi/client/api", () => ({
  grispiAPI: {
    tickets: {
      advancedSearch: jest.fn(),
      getTicket: jest.fn(),
    },
    users: {
      getUser: jest.fn(),
    },
  },
}));

const mockedAdvancedSearch = grispiAPI.tickets.advancedSearch as jest.Mock;

function makeBundle(overrides: Partial<GrispiBundle["context"]> = {}): GrispiBundle {
  return {
    settings: { foo: "bar" },
    context: {
      username: "agent1",
      tenantId: "tenant-1",
      ticketKey: "TICKET-1",
      ticket: {} as GrispiBundle["context"]["ticket"],
      agent: {} as GrispiBundle["context"]["agent"],
      requester: {} as GrispiBundle["context"]["requester"],
      token: "token-abc",
      ...overrides,
    },
  };
}

describe("bootstrapPluginInit", () => {
  beforeEach(() => {
    mockedAdvancedSearch.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("resolve branch: wires auth/settings/loading then routes the ticket key through switchTicket", async () => {
    const bundle = makeBundle();
    const plugin = { _init: jest.fn().mockResolvedValue(bundle) };
    const authentication = { setTenantId: jest.fn(), setToken: jest.fn() };
    const setSettings = jest.fn();
    const setLoading = jest.fn();
    const switchTicket = jest.fn();

    await bootstrapPluginInit({
      plugin,
      authentication,
      setSettings,
      setLoading,
      switchTicket,
    });

    expect(authentication.setTenantId).toHaveBeenCalledWith(
      bundle.context.tenantId
    );
    expect(authentication.setToken).toHaveBeenCalledWith(bundle.context.token);
    expect(setSettings).toHaveBeenCalledWith(bundle.settings);
    expect(setLoading).toHaveBeenCalledWith(false);
    expect(switchTicket).toHaveBeenCalledWith(bundle.context.ticketKey);
  });

  it("reject branch: resolves without throwing, clears loading, and never calls switchTicket/setSettings (no infinite rocket, no unhandled rejection)", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});

    const plugin = {
      _init: jest.fn().mockRejectedValue(new Error("handshake failed")),
    };
    const authentication = { setTenantId: jest.fn(), setToken: jest.fn() };
    const setSettings = jest.fn();
    const setLoading = jest.fn();
    const switchTicket = jest.fn();

    await expect(
      bootstrapPluginInit({
        plugin,
        authentication,
        setSettings,
        setLoading,
        switchTicket,
      })
    ).resolves.toBeUndefined();

    expect(setLoading).toHaveBeenCalledWith(false);
    expect(switchTicket).not.toHaveBeenCalled();
    expect(setSettings).not.toHaveBeenCalled();
  });

  it("store-error integration: a rejecting advanced-search during bootstrap lands the store in status='error' with a typed error, never a permanent 'loading' skeleton — the exact production path the standalone UAT could not exercise", async () => {
    const bundle = makeBundle();
    const plugin = { _init: jest.fn().mockResolvedValue(bundle) };
    const authentication = { setTenantId: jest.fn(), setToken: jest.fn() };
    const setSettings = jest.fn();
    const setLoading = jest.fn();

    const root = new RootStore();
    const store = root.sideConversations;

    mockedAdvancedSearch.mockRejectedValue(new HttpError(500, null));

    let pending: Promise<void> | undefined;
    const switchTicket = (key: string) => {
      pending = store.load(key);
    };

    await bootstrapPluginInit({
      plugin,
      authentication,
      setSettings,
      setLoading,
      switchTicket,
    });
    await pending;

    expect(store.status).toBe("error");
    expect(store.error).toBeInstanceOf(HttpError);
  });
});
