import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { HttpError, NetworkError } from "@/grispi/client/http-handler";
import { grispiAPI } from "@/grispi/client/api";
import {
  StandaloneDevConfig,
  getStandaloneDevConfig,
} from "@/lib/standalone-dev";
import { Settings, Ticket } from "@/types/grispi.type";

import { bootstrapPluginInit } from "./plugin-bootstrap";

type GrispiContextType = {
  ticket: Ticket | null;
  /** Authenticated tenant used to isolate every React Query cache key. */
  tenantId: string | null;
  settings: Settings | null;
  loading: boolean;
  /**
   * The acting agent's email — createTicket's `creator` source (D-13,
   * RESEARCH.md Pitfall #3). Sourced from `bundle.context.agent.email` in
   * plugin mode, or `REACT_APP_DEV_AGENT_EMAIL` (standalone-dev.ts) in
   * local standalone mode. `null` until resolved.
   */
  agentEmail: string | null;
  /** True only in local standalone dev mode (never in the Grispi iframe). */
  standalone: boolean;
  /**
   * Switches the active ticket through the SAME path the SDK's
   * `currentTicketUpdated` event uses. Exposed for the dev-only ticket
   * switcher (standalone mode); harmless no-op surface in plugin mode.
   */
  switchTicket: (ticketKey: string) => void;
};

const GrispiContext = createContext<GrispiContextType | null>(null);

/**
 * Resolved once at module load. When non-null, the SDK bridge is bypassed
 * entirely (see src/lib/standalone-dev.ts for the activation rule — dev
 * build + REACT_APP_DEV_TOKEN only; plugin mode is untouched otherwise).
 */
const standaloneConfig: StandaloneDevConfig | null = getStandaloneDevConfig();

/**
 * SOFT-FAIL GUARD (Plan 01-03 deviation): this used to be a bare
 * `window.GrispiClient.instance()` at module scope, which hard-crashed the
 * whole tree (TypeError on `.instance`) whenever the app was opened outside
 * the Grispi panel iframe. The SDK global's absence must never take down
 * React again — return null and let the provider degrade gracefully.
 */
function getPluginInstance(): any | null {
  try {
    if (typeof window !== "undefined" && window.GrispiClient?.instance) {
      return window.GrispiClient.instance();
    }
  } catch (err) {
    console.error("grispi-context", "GrispiClient.instance() threw", err);
  }
  return null;
}

const plugin = standaloneConfig ? null : getPluginInstance();

export const GrispiProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [agentEmail, setAgentEmail] = useState<string | null>(null);

  // Latest requested ticket key — a slower, older detail fetch must never
  // overwrite a newer switch's ticket (same idea as the store's generation
  // guard, D-15/Pitfall #6).
  const activeKeyRef = useRef<string | null>(null);

  // WR-01 (04.1-REVIEW.md) / CORE-04 — true only once the shared `grispiAPI`
  // client is bound to the resolved host AND tenant credentials. Before
  // that, an SDK `currentTicketUpdated` event arriving mid-handshake would
  // otherwise fetch through `switchTicket` against the class-default host —
  // which this phase moved from preprod to prod — sending a preprod
  // tenant's ticket key to PRODUCTION with empty auth headers (no
  // `tenantId`, no `Authorization`). Flipped exclusively from
  // `bootstrapPluginInit`'s success path (plugin-bootstrap.ts) via
  // `onEnvironmentReady`; never flipped on the reject path.
  const environmentReadyRef = useRef(false);

  /**
   * Shared active-ticket-change path — used by BOTH the SDK's
   * `currentTicketUpdated` event and the standalone dev switcher.
   *
   * D-14/D-15: does NOT flip the global `loading` flag (the rocket
   * LoadingScreen is for bundle init only). Instead it sets a provisional
   * ticket with the new key IMMEDIATELY, so the list screen's
   * `ticket?.key` effect fires `store.load()` synchronously → instant
   * skeleton, zero stale flash. The full ticket details are then hydrated
   * in the background (same key ⇒ no duplicate store load).
   */
  const switchTicket = useCallback(async (ticketKey: string) => {
    if (!ticketKey) return;

    activeKeyRef.current = ticketKey;

    // Provisional: only `key` is consumed by the list screen; the full
    // object replaces this as soon as getTicket resolves.
    setTicket({ key: ticketKey } as Ticket);

    try {
      const response = await grispiAPI.tickets.getTicket(ticketKey);
      if (activeKeyRef.current !== ticketKey) return; // stale switch
      setTicket(response);
    } catch (err) {
      if (activeKeyRef.current !== ticketKey) return;
      if (err instanceof NetworkError) {
        console.error(
          "grispi-context",
          "switchTicket",
          "Network error when fetching ticket details",
          ticketKey
        );
      } else if (err instanceof HttpError) {
        console.error(
          "grispi-context",
          "switchTicket",
          "HTTP error when fetching ticket details",
          ticketKey,
          err.status
        );
      } else {
        console.error(
          "grispi-context",
          "switchTicket",
          "Unexpected error when fetching ticket details",
          ticketKey
        );
      }
    }
  }, []);

  useEffect(() => {
    // ── Standalone dev mode: skip GrispiClient entirely ──────────────────
    if (standaloneConfig) {
      console.info(
        "grispi-context",
        "STANDALONE DEV MODE — Grispi SDK bridge bypassed.",
        `tenant=${standaloneConfig.tenantId}`,
        `ticket=${standaloneConfig.initialTicketKey}`
      );

      grispiAPI.authentication.setTenantId(standaloneConfig.tenantId);
      setTenantId(standaloneConfig.tenantId);
      grispiAPI.authentication.setToken(standaloneConfig.token);
      grispiAPI.setEnvironment(standaloneConfig.environment);
      // Invariant parity only (WR-01) — standalone has no SDK event source,
      // so nothing reads this ref here; behavior is unchanged
      // (04.1-VERIFICATION.md verified truth #9).
      environmentReadyRef.current = true;

      setSettings({});
      setAgentEmail(standaloneConfig.agentEmail);
      setLoading(false);
      void switchTicket(standaloneConfig.initialTicketKey);
      return;
    }

    // ── Plugin mode (unchanged behavior) ────────────────────────────────
    if (!plugin) {
      console.error(
        "grispi-context",
        "Grispi SDK bridge (window.GrispiClient) is unavailable — this app " +
          "normally runs inside the Grispi panel iframe. For local " +
          "standalone testing, create .env.development.local with " +
          "REACT_APP_DEV_TOKEN (see src/lib/standalone-dev.ts) and restart " +
          "`npm start`."
      );
      setTenantId(null);
      setLoading(false);
      return;
    }

    // CORE-03 gap closure (01-VERIFICATION.md CR-01): route the initial
    // fetch through the SAME resilient `switchTicket` path standalone mode
    // and `currentTicketUpdated` already use, and add the missing `.catch`
    // on `_init()`. See src/contexts/plugin-bootstrap.ts for the full
    // rationale — this makes an SDK handshake rejection clear `loading`
    // (no infinite rocket, no unhandled rejection) and makes an initial
    // advanced-search/getTicket failure surface through the store's own
    // `ErrorCard` + "Yeniden dene" instead of hanging forever.
    void bootstrapPluginInit({
      plugin,
      authentication: grispiAPI.authentication,
      setSettings,
      setLoading,
      setAgentEmail,
      setTenantId,
      setEnvironment: grispiAPI.setEnvironment.bind(grispiAPI),
      onEnvironmentReady: () => {
        environmentReadyRef.current = true;
      },
      switchTicket,
    });

    plugin.currentTicketUpdated = async (ticket: Ticket) => {
      // WR-01 (04.1-REVIEW.md) / CORE-04 — the handler stays registered
      // synchronously (a handler that exists but no-ops is always safe for
      // the SDK to invoke; registering it late would leave a window where
      // the SDK could call an undefined member). Only the body is gated.
      // Dropped (not queued): bootstrapPluginInit re-drives the bundle's
      // own `ticketKey` through `switchTicket` the instant the gate opens,
      // so a dropped early event is self-healing. Queueing would need a
      // replay ordered AFTER that call and would entangle with
      // `activeKeyRef`'s stale-switch guard for no real benefit over a
      // window measured in one SDK handshake.
      if (!environmentReadyRef.current) {
        console.info(
          "grispi-context",
          "WR-01/CORE-04: currentTicketUpdated ignored — environment not yet resolved",
          ticket.key
        );
        return;
      }
      // D-14/D-15: no global-loading rocket on ticket switch — the shared
      // path clears the list to skeleton instantly via the provisional key.
      void switchTicket(ticket.key);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <GrispiContext.Provider
      value={{
        ticket,
        tenantId,
        settings,
        loading,
        agentEmail,
        standalone: standaloneConfig !== null,
        switchTicket,
      }}
    >
      {children}
    </GrispiContext.Provider>
  );
};

export const useGrispi = () => {
  const grispi = useContext(GrispiContext);

  if (!grispi) {
    throw new Error("useGrispi must be used within a GrispiProvider.");
  }

  return grispi;
};
