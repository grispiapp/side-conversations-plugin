import { ConfirmDialog } from "./components/confirm-dialog";
import { MessageField } from "./components/message-field";
import { RecipientField } from "./components/recipient-field";
import { SubjectField } from "./components/subject-field";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";

import {
  Screen,
  ScreenContent,
  ScreenHeader,
  ScreenTitle,
} from "@/components/ui/screen";
import { useGrispi } from "@/contexts/grispi-context";
import { useStore } from "@/contexts/store-context";
import { htmlToText } from "@/lib/html-to-text";
import { formatPrefillSubject } from "@/lib/side-conversation";
import { useCreateSideConversationMutation } from "@/query/side-conversation-queries";

/**
 * Compose screen (COMP-01/02/03/04). RecipientField/SubjectField/MessageField
 * were wired in Plan 03/04 (see 02-UI-SPEC.md "Compose screen anatomy").
 * D-02 (dirty-back guard): `onBack` reads the real `compose.isDirty` and, if
 * `panelNav.requestBack` reports the form is dirty, opens the local
 * `ConfirmDialog` instead of silently swallowing the back-tap.
 */
export const ComposeScreen = observer(() => {
  const { tenantId, agentEmail, ticket } = useGrispi();
  const panelNav = useStore().panelNavigation;
  const compose = useStore().compose;
  const activeConversation = useStore().activeConversation;
  const attachmentUpload = useStore().attachmentUpload;
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
    htmlToText(compose.message) === "" ||
    compose.submitting;

  const submit = async () => {
    if (
      compose.submitting ||
      !tenantId ||
      !agentEmail ||
      !ticket?.key ||
      sendDisabled
    ) {
      return;
    }

    const selected = panelNav.reservePendingConversation(
      compose.getEffectiveParentKey(ticket.key)
    );
    // D-16: computed from the compose surface's attachment bucket against
    // the SAME final body HTML `submit` will itself sanitize and send —
    // `compose.message` is already the sanitized text MessageField's
    // `setAuthoredMessage` last wrote (see ComposeStore.submit's own
    // doc-comment for why this is the caller's job, not the store's).
    const attachmentIds = attachmentUpload.collectAttachmentIds(
      "compose",
      compose.message
    );
    const envelope = await compose.submit(
      tenantId,
      agentEmail,
      ticket.key,
      selected.sessionKey,
      attachmentIds
    );
    if (!envelope) {
      panelNav.cancelPendingConversationReservation(selected.sessionKey);
      return;
    }
    if (!panelNav.showPendingConversation(selected.sessionKey)) return;
    createMutation.mutate(envelope);
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
      // only `[<KEY>]`, preserving D-09's empty-title tolerance.
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
        title={<ScreenTitle>Yeni Konuşma</ScreenTitle>}
        backLabel="Yan konuşma listesine dön"
        onBack={() => {
          // D-02: `requestBack` returns `true` only when the form is dirty —
          // in that case it deliberately does NOT change screens, so the
          // dialog is the only thing left to act on the dirty-back-tap.
          if (panelNav.requestBack(isDirty)) {
            setDiscardOpen(true);
          }
        }}
      />
      <ScreenContent className="flex flex-col bg-card">
        <div
          className="flex min-h-0 flex-1 flex-col"
          aria-label="Yeni konuşma e-postası"
        >
          <RecipientField />
          <SubjectField />
          <MessageField
            submitDisabled={sendDisabled}
            onSubmit={() => void submit()}
          />
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
