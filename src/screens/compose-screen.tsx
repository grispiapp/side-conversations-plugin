import { observer } from "mobx-react-lite";
import { useEffect } from "react";

import {
  Screen,
  ScreenContent,
  ScreenHeader,
  ScreenTitle,
} from "@/components/ui/screen";
import { useGrispi } from "@/contexts/grispi-context";
import { useStore } from "@/contexts/store-context";
import { formatPrefillSubject } from "@/lib/side-conversation";

import { RecipientField } from "./components/recipient-field";
import { SubjectField } from "./components/subject-field";

/**
 * Compose screen (COMP-01/02/03). RecipientField/SubjectField land this
 * plan (see 02-UI-SPEC.md "Compose screen anatomy") — MessageField/"Gönder"
 * follow in Plan 04/05. `isDirty` is still hardcoded `false`: Plan 05
 * replaces this with the actual dirty check against compose-store field
 * state (D-02).
 */
export const ComposeScreen = observer(() => {
  const { ticket } = useGrispi();
  const panelNav = useStore().panelNavigation;
  const compose = useStore().compose;

  const isDirty = false;

  // D-08/D-09: prefill the subject exactly once per mounted ticket, using
  // the SAME `[ticket?.key]` effect-bridging pattern as
  // ConversationsListScreen (02-PATTERNS.md). `initSubject`'s own
  // `subjectInitialized` guard is what actually prevents overwrites — this
  // effect firing more than once (e.g. a ticket-key no-op re-render) is
  // harmless.
  useEffect(() => {
    if (ticket?.key) {
      // Pitfall #6 (01-02-probe-findings.md): the full `Ticket` returned by
      // `getTicket` has NO subject field (confirmed live) — only the
      // advanced-search SUMMARY carries `subject`, and this hydrated
      // PARENT ticket is not that summary. Read defensively (untyped,
      // optional) in case Grispi ever adds one to the full ticket shape;
      // today it's always absent, so the prefill correctly degrades to
      // just `[<KEY>]` (D-09's "boş-başlık toleransı").
      const ticketTitle =
        (ticket as unknown as { subject?: string }).subject ?? "";
      compose.initSubject(formatPrefillSubject(ticket.key, ticketTitle));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket?.key]);

  return (
    <Screen>
      <ScreenHeader onBack={() => panelNav.requestBack(isDirty)}>
        <ScreenTitle>Yeni Görüşme</ScreenTitle>
      </ScreenHeader>
      <ScreenContent>
        <div className="flex h-full flex-col gap-2 p-4">
          <RecipientField />
          <SubjectField />
          {/* MessageField / "Gönder" — Plan 04/05 */}
        </div>
      </ScreenContent>
    </Screen>
  );
});
