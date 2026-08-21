import type * as ReactNamespace from "react";
import type { Root } from "react-dom/client";

import { GrispiBundle, Ticket } from "@/types/grispi.type";

// WR-01 regression coverage (04.1-REVIEW.md). This is the first test in the
// repo that renders the REAL GrispiProvider — no wholesale mock of
// "@/contexts/grispi-context" here, unlike every screen test.
//
// Mocked at file scope (not inside the module-registry isolation helper
// below) so the spies declared here survive `jest.isolateModules` re-running
// the mock factory on every render: the factory returns thin delegating
// arrows around these `mock*` spies, so even though a fresh `grispiAPI`
// object is constructed per isolated registry, the underlying jest.fn()s
// stay the same instances across the whole test file.
const mockGetTicket = jest.fn();
const mockSetEnvironment = jest.fn();
const mockSetTenantId = jest.fn();
const mockSetToken = jest.fn();

jest.mock("@/grispi/client/api", () => ({
  grispiAPI: {
    tickets: {
      getTicket: (...args: unknown[]) => mockGetTicket(...args),
    },
    authentication: {
      setTenantId: (...args: unknown[]) => mockSetTenantId(...args),
      setToken: (...args: unknown[]) => mockSetToken(...args),
    },
    setEnvironment: (...args: unknown[]) => mockSetEnvironment(...args),
  },
}));

function makeBundle(
  overrides: Partial<GrispiBundle["context"]> = {}
): GrispiBundle {
  return {
    settings: {},
    context: {
      username: "agent1",
      tenantId: "tenant-1",
      ticketKey: "BUNDLE-TICKET",
      ticket: {} as GrispiBundle["context"]["ticket"],
      agent: {
        id: 15,
        fullName: "Davut Kember",
        email: "davutkmbr@gmail.com",
        phone: "",
      },
      requester: {} as GrispiBundle["context"]["requester"],
      // Non-JWT token — resolves to the `prod` environment via
      // resolveGrispiEnvironment's parseJwt-degrades-to-null path
      // (environment_facts). setEnvironment is mocked, so the resolved
      // value is inert here either way.
      token: "token-abc",
      ...overrides,
    },
  };
}

function makeTicket(key: string): Ticket {
  return { key } as Ticket;
}

/**
 * Deferred `_init()` — captures `resolve`/`reject` into outer variables so
 * tests can control exactly when the SDK handshake settles. This is what
 * opens the pre-bootstrap window the WR-01 race lives in.
 */
function makeDeferredPluginStub(bundle: GrispiBundle) {
  let resolveInit!: (value: GrispiBundle) => void;
  let rejectInit!: (reason: unknown) => void;
  const initPromise = new Promise<GrispiBundle>((resolve, reject) => {
    resolveInit = resolve;
    rejectInit = reject;
  });

  const pluginStub: {
    _init: jest.Mock<Promise<GrispiBundle>, []>;
    currentTicketUpdated?: (ticket: Ticket) => void;
  } = {
    _init: jest.fn(() => initPromise),
  };

  return {
    pluginStub,
    resolveInit: () => {
      resolveInit(bundle);
      return initPromise;
    },
    rejectInit: (reason: unknown) => {
      rejectInit(reason);
      return initPromise.catch(() => undefined);
    },
  };
}

interface LoadedProvider {
  react: typeof ReactNamespace;
  GrispiProvider: React.FC<{ children: ReactNamespace.ReactNode }>;
  createRoot: (container: Element) => Root;
  /** Untyped here (test-only) — same isolated-module instance as GrispiProvider. */
  useGrispi: () => Record<string, unknown>;
}

/**
 * Module-scope hazard (environment_facts): `grispi-context.tsx` reads
 * `window.GrispiClient` and resolves `plugin` at MODULE LOAD, so the stub
 * must be installed before the module is imported. `jest.isolateModules`
 * gives each test a fresh module registry so a freshly-required
 * `GrispiProvider` re-reads `window.GrispiClient` from scratch.
 *
 * "react" and "react-dom/client" are ALSO required from inside the SAME
 * `isolateModules` callback (not via this file's static imports) — the
 * isolated registry gives every module required inside it its own fresh
 * copy, including transitive dependencies. If the provider's `react`
 * (required transitively while loading `@/contexts/grispi-context`) were a
 * different module instance than the one driving `createRoot`/`act`, React's
 * hook dispatcher would be null during render (two disconnected React
 * copies). Requiring all three together inside one isolate keeps them on
 * the same instance.
 */
function loadGrispiProvider(pluginStub: unknown): LoadedProvider {
  (window as unknown as { GrispiClient: unknown }).GrispiClient = {
    instance: () => pluginStub,
  };

  jest.resetModules();

  let loaded: LoadedProvider;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const react = require("react") as typeof ReactNamespace;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const reactDomClient = require("react-dom/client");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ctx = require("@/contexts/grispi-context");

    loaded = {
      react,
      GrispiProvider: ctx.GrispiProvider,
      useGrispi: ctx.useGrispi,
      createRoot: reactDomClient.createRoot,
    };
  });

  return loaded!;
}

let container: HTMLDivElement;
let activeRoot: Root | null = null;
let activeAct: typeof ReactNamespace.act | null = null;

function renderProvider(
  loaded: LoadedProvider,
  children: ReactNamespace.ReactNode
): void {
  activeRoot = loaded.createRoot(container);
  activeAct = loaded.react.act;
  activeAct(() => {
    activeRoot!.render(
      loaded.react.createElement(loaded.GrispiProvider, null, children)
    );
  });
}

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);

  mockGetTicket.mockReset();
  mockGetTicket.mockResolvedValue(makeTicket("resolved-ticket"));
  mockSetEnvironment.mockReset();
  mockSetTenantId.mockReset();
  mockSetToken.mockReset();
});

afterEach(() => {
  if (activeRoot && activeAct) {
    activeAct(() => activeRoot!.unmount());
  }
  activeRoot = null;
  activeAct = null;
  container.remove();
  jest.resetModules();
  delete (window as unknown as { GrispiClient?: unknown }).GrispiClient;
});

describe("GrispiProvider — WR-01 pre-bootstrap SDK ticket-update gate", () => {
  it("Test A (regression): a currentTicketUpdated event fired before _init() resolves issues zero getTicket calls", async () => {
    const bundle = makeBundle();
    const { pluginStub } = makeDeferredPluginStub(bundle);
    const loaded = loadGrispiProvider(pluginStub);

    renderProvider(loaded, loaded.react.createElement("div", null, "child"));

    expect(typeof pluginStub.currentTicketUpdated).toBe("function");

    await activeAct!(async () => {
      pluginStub.currentTicketUpdated!(makeTicket("EARLY-TICKET"));
      await Promise.resolve();
    });

    // This is the assertion that must fail on the pre-fix tree: an
    // ungated handler calls switchTicket -> grispiAPI.tickets.getTicket
    // immediately, while the environment (and auth) are still unresolved.
    expect(mockGetTicket).not.toHaveBeenCalled();
    expect(mockSetEnvironment).not.toHaveBeenCalled();
  });

  it("Test B (no regression): after _init() resolves, currentTicketUpdated reaches getTicket with the event's ticket key", async () => {
    const bundle = makeBundle();
    const { pluginStub, resolveInit } = makeDeferredPluginStub(bundle);
    const loaded = loadGrispiProvider(pluginStub);

    renderProvider(loaded, loaded.react.createElement("div", null, "child"));

    await activeAct!(async () => {
      await resolveInit();
      await Promise.resolve();
    });

    mockGetTicket.mockClear();

    await activeAct!(async () => {
      pluginStub.currentTicketUpdated!(makeTicket("LATER-TICKET"));
      await Promise.resolve();
    });

    expect(mockGetTicket).toHaveBeenCalledWith("LATER-TICKET");
  });

  it("Test C (CORE-03 not regressed): resolving _init() routes the bundle's own ticketKey through switchTicket, after setEnvironment", async () => {
    const bundle = makeBundle({ ticketKey: "BUNDLE-TICKET" });
    const { pluginStub, resolveInit } = makeDeferredPluginStub(bundle);
    const loaded = loadGrispiProvider(pluginStub);

    renderProvider(loaded, loaded.react.createElement("div", null, "child"));

    await activeAct!(async () => {
      await resolveInit();
      await Promise.resolve();
    });

    expect(mockGetTicket).toHaveBeenCalledWith("BUNDLE-TICKET");
    expect(mockSetEnvironment.mock.invocationCallOrder[0]).toBeLessThan(
      mockGetTicket.mock.invocationCallOrder[0]
    );
  });

  it("Test D (reject path): when _init() rejects, a subsequent currentTicketUpdated event still issues zero getTicket calls", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const bundle = makeBundle();
    const { pluginStub, rejectInit } = makeDeferredPluginStub(bundle);
    const loaded = loadGrispiProvider(pluginStub);

    renderProvider(loaded, loaded.react.createElement("div", null, "child"));

    await activeAct!(async () => {
      await rejectInit(new Error("handshake failed"));
      await Promise.resolve();
    });

    mockGetTicket.mockClear();

    await activeAct!(async () => {
      pluginStub.currentTicketUpdated!(makeTicket("POST-REJECT-TICKET"));
      await Promise.resolve();
    });

    expect(mockGetTicket).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("Task 3: logs the payload diagnostic exactly once, still calls getTicket exactly once with the event's key, and never throws on a fieldMap-less ticket", async () => {
    const consoleInfoSpy = jest
      .spyOn(console, "info")
      .mockImplementation(() => {});

    const bundle = makeBundle();
    const { pluginStub, resolveInit } = makeDeferredPluginStub(bundle);
    const loaded = loadGrispiProvider(pluginStub);

    renderProvider(loaded, loaded.react.createElement("div", null, "child"));

    await activeAct!(async () => {
      await resolveInit();
      await Promise.resolve();
    });

    mockGetTicket.mockClear();
    consoleInfoSpy.mockClear();

    // No `fieldMap` on this payload at all — the diagnostic must degrade
    // to hasFieldMap:false/fieldMapKeyCount:0 rather than throw.
    await expect(
      activeAct!(async () => {
        pluginStub.currentTicketUpdated!(makeTicket("DIAGNOSTIC-TICKET"));
        await Promise.resolve();
      })
    ).resolves.not.toThrow();

    const diagnosticCalls = consoleInfoSpy.mock.calls.filter(
      (call) => call[1] === "currentTicketUpdated payload diagnostic"
    );
    expect(diagnosticCalls).toHaveLength(1);
    expect(diagnosticCalls[0][2]).toMatchObject({
      hasFieldMap: false,
      fieldMapKeyCount: 0,
      hasParentField: false,
    });
    expect(diagnosticCalls[0][2].keys).toContain("key");

    // switchTicket's own behavior is untouched — one getTicket call, with
    // the event's ticket key.
    expect(mockGetTicket).toHaveBeenCalledTimes(1);
    expect(mockGetTicket).toHaveBeenCalledWith("DIAGNOSTIC-TICKET");

    consoleInfoSpy.mockRestore();
  });
});

describe("GrispiProvider — standalone mode context values (D-07/D-13)", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("environment and agentName mirror standaloneConfig's resolved values", async () => {
    process.env.NODE_ENV = "development";
    process.env.REACT_APP_DEV_TOKEN = "dev-token";
    process.env.REACT_APP_DEV_GRISPI_ENV = "preprod";
    process.env.REACT_APP_DEV_AGENT_NAME = "Test Agent";

    // Standalone mode never reads window.GrispiClient — the stub here is
    // inert, only present because loadGrispiProvider always installs one.
    const loaded = loadGrispiProvider({ _init: jest.fn() });

    let captured: Record<string, unknown> | null = null;
    function Capture(): null {
      captured = loaded.useGrispi();
      return null;
    }

    renderProvider(loaded, loaded.react.createElement(Capture));

    // switchTicket's background getTicket() call resolves on a microtask —
    // flush it inside act so the provider's own state update isn't left
    // dangling past this test.
    await activeAct!(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(captured).not.toBeNull();
    expect(captured!.environment).toBe("preprod");
    expect(captured!.agentName).toBe("Test Agent");
  });
});
