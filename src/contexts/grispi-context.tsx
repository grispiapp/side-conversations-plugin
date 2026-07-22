import React, {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import { HttpError, NetworkError } from "@/grispi/client/http-handler";
import { grispiAPI } from "@/grispi/client/api";
import { GrispiBundle, Settings, Ticket } from "@/types/grispi.type";

type GrispiContextType = {
  ticket: Ticket | null;
  settings: Settings | null;
  loading: boolean;
};

const GrispiContext = createContext<GrispiContextType | null>(null);

const plugin = window.GrispiClient.instance();

export const GrispiProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    plugin._init().then(async (bundle: GrispiBundle) => {
      setLoading(true);

      grispiAPI.authentication.setTenantId(bundle.context.tenantId);
      grispiAPI.authentication.setToken(bundle.context.token);

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
      setLoading(true);

      try {
        const response = await grispiAPI.tickets.getTicket(ticket.key);
        setTicket(response);
      } catch (err) {
        if (err instanceof NetworkError) {
          console.error(
            "grispi-context",
            "currentTicketUpdated",
            "Network error when fetching ticket details",
            ticket.key
          );
        } else if (err instanceof HttpError) {
          console.error(
            "grispi-context",
            "currentTicketUpdated",
            "HTTP error when fetching ticket details",
            ticket.key,
            err.status
          );
        } else {
          console.error(
            "grispi-context",
            "currentTicketUpdated",
            "Unexpected error when fetching ticket details",
            ticket.key
          );
        }
      }

      setLoading(false);
    };
  }, []);

  return (
    <GrispiContext.Provider
      value={{
        ticket,
        settings,
        loading,
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
