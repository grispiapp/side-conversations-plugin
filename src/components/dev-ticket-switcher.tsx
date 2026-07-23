import { FC, useState } from "react";

import { Button } from "@/components/ui/button";
import { useGrispi } from "@/contexts/grispi-context";

/**
 * Dev-only active-ticket switcher (Plan 01-03 deviation — UAT enabler).
 * Rendered ONLY in standalone dev mode (never inside the Grispi iframe).
 * Drives the SAME `switchTicket` path the SDK's `currentTicketUpdated`
 * event uses, so the D-15 stale-flash UAT step is exercisable locally
 * without a page reload.
 */
export const DevTicketSwitcher: FC = () => {
  const { standalone, ticket, switchTicket } = useGrispi();
  const [value, setValue] = useState("");

  if (!standalone) return null;

  const submit = () => {
    const key = value.trim();
    if (key) switchTicket(key);
  };

  return (
    <div className="fixed bottom-2 right-2 z-50 flex items-center gap-1 rounded-md border border-input bg-white/95 p-1 shadow-md">
      <span className="px-1 font-mono text-[10px] text-muted-foreground">
        DEV · {ticket?.key ?? "—"}
      </span>
      <input
        className="h-7 w-28 rounded border border-input px-1 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        placeholder="TICKET-563"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      <Button size="sm" variant="secondary" className="h-7 px-2" onClick={submit}>
        Değiştir
      </Button>
    </div>
  );
};
