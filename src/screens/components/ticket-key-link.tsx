import { ExternalLinkIcon } from "@radix-ui/react-icons";

import { GrispiEnvironment, buildAgentTicketUrl } from "@/grispi/client/environment";

interface TicketKeyLinkProps {
  tenantId: string;
  environment: GrispiEnvironment;
  ticketKey: string;
}

/**
 * D-06/D-07/D-10 — the side ticket's key, rendered as a purple/monospace
 * external link that opens the real ticket in the Grispi agent UI.
 *
 * Deliberately reads none of its three inputs from `useGrispi()`/context
 * itself: they arrive as props so the component stays pure, testable
 * without a provider, and so every call site visibly sources its values
 * from a trusted context (D-08) rather than this component reaching for
 * them implicitly.
 */
export function TicketKeyLink({
  tenantId,
  environment,
  ticketKey,
}: TicketKeyLinkProps) {
  return (
    <a
      href={buildAgentTicketUrl(tenantId, environment, ticketKey)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${ticketKey} talebini yeni sekmede aç`}
      className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-sm
                 font-mono text-sm font-semibold text-primary
                 underline decoration-primary/40 underline-offset-2
                 hover:decoration-primary
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {ticketKey}
      <ExternalLinkIcon className="size-3 shrink-0" aria-hidden="true" />
    </a>
  );
}
