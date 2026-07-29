import { ConfirmDialog } from "./components/confirm-dialog";
import { MessageField } from "./components/message-field";
import { RecipientField } from "./components/recipient-field";
import { SubjectField } from "./components/subject-field";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Screen,
  ScreenContent,
  ScreenHeader,
  ScreenTitle,
} from "@/components/ui/screen";
import { useGrispi } from "@/contexts/grispi-context";
import { useStore } from "@/contexts/store-context";
import { formatPrefillSubject } from "@/lib/side-conversation";
import { useCreateSideConversationMutation } from "@/query/side-conversation-queries";

/**
 * Compose screen (COMP-01/02/03/04). RecipientField/SubjectField/MessageField
 * were wired in Plan 03/04 (see 02-UI-SPEC.md "Compose screen anatomy") —
 * this plan adds the full-width "Gönder" action bar, closing the happy path.
 * D-02 (dirty-back guard): `onBack` reads the real `compose.isDirty` and, if
 * `panelNav.requestBack` reports the form is dirty, opens the local
 * `ConfirmDialog` instead of silently swallowing the back-tap.
 */
export const ComposeScreen = observer(() => {
  const { tenantId, agentEmail, ticket } = useGrispi();
  const panelNav = useStore().panelNavigation;
  const compose = useStore().compose;
  const activeConversation = useStore().activeConversation;
  const createMutation = useCreateSideConversationMutation({
    activeConversation,
    getSelectedConversation: () => panelNav.selectedConversation,
    bindCreatedTicket: (sessionKey, sideKey) =>
      panelNav.bindCreatedTicket(sessionKey, sideKey),
  });

  const [discardOpen, setDiscardOpen] = useState(false);

  const isDirty = compose.isDirty;

  const sendDisabled =
    !tenantId ||
    !agentEmail ||
    !ticket?.key ||
    !compose.recipientEmail ||
    compose.message.trim() === "" ||
    compose.submitting;

  const submit = async () => {
    if (!tenantId || !agentEmail || !ticket?.key || sendDisabled) return;

    const selected = panelNav.openPendingConversation(
      compose.getEffectiveParentKey(ticket.key)
    );
    const envelope = await compose.submit(
      tenantId,
      agentEmail,
      ticket.key,
      selected.sessionKey
    );
    if (envelope) createMutation.mutate(envelope);
  };

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
      // M-3b: `initSubject` also pins this compose session's parent key
      // (T-02-01) — guarded by the same one-shot as the subject prefill.
      compose.initSubject(
        formatPrefillSubject(ticket.key, ticketTitle),
        ticket.key
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket?.key]);

  return (
    <Screen>
      <ScreenHeader
        onBack={() => {
          // D-02: `requestBack` returns `true` only when the form is dirty —
          // in that case it deliberately does NOT change screens, so the
          // dialog is the only thing left to act on the dirty-back-tap.
          if (panelNav.requestBack(isDirty)) {
            setDiscardOpen(true);
          }
        }}
      >
        <ScreenTitle>Yeni Görüşme</ScreenTitle>
      </ScreenHeader>
      <ScreenContent className="flex flex-col">
        <div className="flex flex-1 flex-col gap-2 p-4">
          <RecipientField />
          <SubjectField />
          <MessageField onSubmit={() => void submit()} />
        </div>
        <div className="sticky bottom-0 border-t bg-card p-4">
          <Button
            className="w-full"
            disabled={sendDisabled}
            onClick={() => void submit()}
          >
            Gönder
          </Button>
        </div>
      </ScreenContent>

      {discardOpen && (
        <ConfirmDialog
          title="Vazgeçilsin mi?"
          body="Yazılanlar kaybolur."
          cancelLabel="İptal"
          confirmLabel="Vazgeç"
          onCancel={() => setDiscardOpen(false)}
          onConfirm={() => {
            compose.reset();
            panelNav.confirmDiscardAndReturnToList();
            setDiscardOpen(false);
          }}
        />
      )}
    </Screen>
  );
});
