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
import { GrispiBundle, Settings, Ticket } from "@/types/grispi.type";

type GrispiContextType = {
  ticket: Ticket | null;
  settings: Settings | null;
  loading: boolean;
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
  const [settings, setSettings] = useState<Settings | null>(null);

  // Latest requested ticket key — a slower, older detail fetch must never
  // overwrite a newer switch's ticket (same idea as the store's generation
  // guard, D-15/Pitfall #6).
  const activeKeyRef = useRef<string | null>(null);

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
      grispiAPI.authentication.setToken(standaloneConfig.token);

      setSettings({});
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
      setLoading(false);
      return;
    }

    plugin._init().then(async (bundle: GrispiBundle) => {
      setLoading(true);

      grispiAPI.authentication.setTenantId(bundle.context.tenantId);
      grispiAPI.authentication.setToken(bundle.context.token);

      activeKeyRef.current = bundle.context.ticketKey;

      try {
        const ticket = await grispiAPI.tickets.getTicket(
          bundle.context.ticketKey
        );

        setTicket(ticket);
      } catch (err) {
        if (err instanceof NetworkError) {
          console.error(
            "grispi-context",
            "_init",
            "Network error when fetching initial ticket",
            bundle.context.ticketKey
          );
        } else if (err instanceof HttpError) {
          console.error(
            "grispi-context",
            "_init",
            "HTTP error when fetching initial ticket",
            bundle.context.ticketKey,
            err.status
          );
        } else {
          console.error(
            "grispi-context",
            "_init",
            "Unexpected error when fetching initial ticket",
            bundle.context.ticketKey
          );
        }
      }

      setSettings(bundle.settings);
      setLoading(false);
    });

    plugin.currentTicketUpdated = async (ticket: Ticket) => {
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
        settings,
        loading,
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
