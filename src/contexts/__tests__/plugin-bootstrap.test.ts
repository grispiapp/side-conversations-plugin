import { bootstrapPluginInit } from "@/contexts/plugin-bootstrap";
import { grispiAPI } from "@/grispi/client/api";
import { HttpError } from "@/grispi/client/http-handler";
import { createTestQueryClient } from "@/query/query-client";
import { sideConversationKeys } from "@/query/query-keys";
import { sideConversationListOptions } from "@/query/side-conversation-queries";
import { GrispiBundle } from "@/types/grispi.type";

// The bootstrap integration below drives the same Query-owned list contract
// the production list screen consumes after tenant publication.
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

function makeBundle(
  overrides: Partial<GrispiBundle["context"]> = {}
): GrispiBundle {
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
    const bundle = makeBundle({
      agent: {
        id: 15,
        fullName: "Davut Kember",
        email: "davutkmbr@gmail.com",
        phone: "",
      },
    });
    const plugin = { _init: jest.fn().mockResolvedValue(bundle) };
    const authentication = { setTenantId: jest.fn(), setToken: jest.fn() };
    const setSettings = jest.fn();
    const setLoading = jest.fn();
    const setAgentEmail = jest.fn();
    const setTenantId = jest.fn();
    const switchTicket = jest.fn();

    await bootstrapPluginInit({
      plugin,
      authentication,
      setSettings,
      setLoading,
      setAgentEmail,
      setTenantId,
      switchTicket,
    });

    expect(authentication.setTenantId).toHaveBeenCalledWith(
      bundle.context.tenantId
    );
    expect(authentication.setToken).toHaveBeenCalledWith(bundle.context.token);
    expect(setSettings).toHaveBeenCalledWith(bundle.settings);
    expect(setLoading).toHaveBeenCalledWith(false);
    expect(switchTicket).toHaveBeenCalledWith(bundle.context.ticketKey);
    expect(setAgentEmail).toHaveBeenCalledWith(bundle.context.agent.email);
    expect(setTenantId).toHaveBeenCalledWith(bundle.context.tenantId);
    expect(authentication.setTenantId.mock.invocationCallOrder[0]).toBeLessThan(
      setTenantId.mock.invocationCallOrder[0]
    );
    expect(setTenantId.mock.invocationCallOrder[0]).toBeLessThan(
      setLoading.mock.invocationCallOrder[0]
    );
    expect(setTenantId.mock.invocationCallOrder[0]).toBeLessThan(
      switchTicket.mock.invocationCallOrder[0]
    );
  });

  it("resolve branch: calls setAgentEmail with null when the bundle carries no agent", async () => {
    const bundle = makeBundle({
      agent: undefined as unknown as GrispiBundle["context"]["agent"],
    });
    const plugin = { _init: jest.fn().mockResolvedValue(bundle) };
    const authentication = { setTenantId: jest.fn(), setToken: jest.fn() };
    const setSettings = jest.fn();
    const setLoading = jest.fn();
    const setAgentEmail = jest.fn();
    const setTenantId = jest.fn();
    const switchTicket = jest.fn();

    await bootstrapPluginInit({
      plugin,
      authentication,
      setSettings,
      setLoading,
      setAgentEmail,
      setTenantId,
      switchTicket,
    });

    expect(setAgentEmail).toHaveBeenCalledWith(null);
  });

  it("reject branch: resolves without throwing, clears loading, and never calls switchTicket/setSettings (no infinite rocket, no unhandled rejection)", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});

    const plugin = {
      _init: jest.fn().mockRejectedValue(new Error("handshake failed")),
    };
    const authentication = { setTenantId: jest.fn(), setToken: jest.fn() };
    const setSettings = jest.fn();
    const setLoading = jest.fn();
    const setAgentEmail = jest.fn();
    const setTenantId = jest.fn();
    const switchTicket = jest.fn();

    await expect(
      bootstrapPluginInit({
        plugin,
        authentication,
        setSettings,
        setLoading,
        setAgentEmail,
        setTenantId,
        switchTicket,
      })
    ).resolves.toBeUndefined();

    expect(setLoading).toHaveBeenCalledWith(false);
    expect(switchTicket).not.toHaveBeenCalled();
    expect(setSettings).not.toHaveBeenCalled();
    expect(setTenantId).toHaveBeenCalledTimes(1);
    expect(setTenantId).toHaveBeenCalledWith(null);
  });

  it("query-error integration: a rejecting advanced-search after bootstrap lands the exact list key in error", async () => {
    const bundle = makeBundle();
    const plugin = { _init: jest.fn().mockResolvedValue(bundle) };
    const authentication = { setTenantId: jest.fn(), setToken: jest.fn() };
    const setSettings = jest.fn();
    const setLoading = jest.fn();
    const setAgentEmail = jest.fn();
    const setTenantId = jest.fn();

    const client = createTestQueryClient();

    mockedAdvancedSearch.mockRejectedValue(new HttpError(500, null));

    let pending: ReturnType<typeof client.fetchInfiniteQuery> | undefined;
    const switchTicket = (key: string) => {
      pending = client.fetchInfiniteQuery(
        sideConversationListOptions(bundle.context.tenantId, key)
      );
    };

    await bootstrapPluginInit({
      plugin,
      authentication,
      setSettings,
      setLoading,
      setAgentEmail,
      setTenantId,
      switchTicket,
    });
    await expect(pending).rejects.toBeInstanceOf(HttpError);

    expect(
      client.getQueryState(
        sideConversationKeys.list(
          bundle.context.tenantId,
          bundle.context.ticketKey
        )
      )?.status
    ).toBe("error");
  });
});
