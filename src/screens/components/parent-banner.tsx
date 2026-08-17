import { ExternalLinkIcon, InfoCircledIcon } from "@radix-ui/react-icons";

import { Button } from "@/components/ui/button";
import {
  GrispiEnvironment,
  buildAgentTicketUrl,
} from "@/grispi/client/environment";

import { ParentKeyChip } from "./parent-key-chip";

interface ParentBannerProps {
  parentKey: string;
  tenantId: string | null;
  environment: GrispiEnvironment | null;
}

/**
 * UX-03/D-11 — renders in place of the conversation list whenever the
 * ACTIVE ticket is itself a side conversation. Informational tone only
 * (never destructive) — nested side conversations simply don't exist, this
 * isn't something the agent did wrong.
 *
 * Never steals focus on mount: this state is always reached via an
 * external event (the host tab switching tickets), never a click inside
 * this panel.
 */
export function ParentBanner({
  parentKey,
  tenantId,
  environment,
}: ParentBannerProps) {
  // D-07/D-08 — never a broken/partial href; the link simply doesn't exist
  // yet if the trusted context inputs aren't resolved.
  const href =
    tenantId && environment
      ? buildAgentTicketUrl(tenantId, environment, parentKey)
      : null;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <InfoCircledIcon
        className="size-8 text-muted-foreground"
        aria-hidden="true"
      />
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">
          Bu talep bir yan konuşma
        </h2>
        <p className="text-sm text-muted-foreground">
          Bu talep, aşağıdaki talebin yan konuşmasıdır. Buradan yeni bir yan
          konuşma başlatılamaz.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <ParentKeyChip parentKey={parentKey} />
        {href ? (
          <Button variant="outline" size="sm" asChild>
            <a href={href} target="_blank" rel="noopener noreferrer">
              Üst talebe git
              <ExternalLinkIcon className="ml-1 size-3.5" aria-hidden="true" />
            </a>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Üst talebe git
            <ExternalLinkIcon className="ml-1 size-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
