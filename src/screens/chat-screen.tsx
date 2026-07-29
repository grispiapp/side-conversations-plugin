import { ConfirmDialog } from "./components/confirm-dialog";
import { RichTextComposer } from "./components/rich-text-composer";
import { ThreadMessage } from "./components/thread-message";
import {
  ChevronLeftIcon,
  DotsHorizontalIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Screen, ScreenTitle } from "@/components/ui/screen";
import { useGrispi } from "@/contexts/grispi-context";
import { useStore } from "@/contexts/store-context";
import {
  MutationBoundary,
  useCreateSideConversationMutation,
  useReplySideConversationMutation,
  useSideConversationDetailQuery,
  useStatusSideConversationMutation,
} from "@/query/side-conversation-queries";
import { MessageVM, MutationEnvelope } from "@/store/active-conversation-store";

const SOLVE_CONFIRMATION =
  "Görüşme çözüldü olarak işaretlensin mi? Yeni bir e-posta yanıtı gelirse tekrar aktif olur.";

function messagePresentation(
  messages: MessageVM[]
): Array<{ message: MessageVM; showFullSender: boolean }> {
  let externalSeen = false;
  return messages.map((message) => {
    const showFullSender =
      message.direction === "incoming" && !message.internal && !externalSeen;
    if (message.direction === "incoming" && !message.internal) {
      externalSeen = true;
    }
    return { message, showFullSender };
  });
}

export const ChatScreen = observer(() => {
  const store = useStore();
  const activeConversation = store.activeConversation;
  const panelNavigation = store.panelNavigation;
  const selected = panelNavigation.selectedConversation;
  const { tenantId, agentEmail } = useGrispi();
  const sideKey = selected?.ticketKey ?? null;
  const parentKey = selected?.parentKey ?? null;
  const sessionKey = selected?.sessionKey ?? null;

  const boundary: MutationBoundary = {
    activeConversation,
    getSelectedConversation: () => panelNavigation.selectedConversation,
    bindCreatedTicket: (selectedSessionKey, createdSideKey) =>
      panelNavigation.bindCreatedTicket(selectedSessionKey, createdSideKey),
  };
  const detail = useSideConversationDetailQuery(
    tenantId,
    sideKey,
    parentKey,
    sessionKey,
    activeConversation
  );
  const createMutation = useCreateSideConversationMutation(boundary);
  const replyMutation = useReplySideConversationMutation(boundary);
  const statusMutation = useStatusSideConversationMutation(boundary);

  const [menuOpen, setMenuOpen] = useState(false);
  const [solveDialogOpen, setSolveDialogOpen] = useState(false);
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const messageRefs = useRef(new Map<string, HTMLElement>());

  const canonicalMessages = detail.data?.messages ?? [];
  const messages =
    sessionKey === null
      ? []
      : sideKey
        ? activeConversation.mergeCanonical(
            sessionKey,
            sideKey,
            canonicalMessages
          )
        : activeConversation.getOverlayMessages(sessionKey, null);
  const localPresentation =
    sessionKey === null
      ? null
      : activeConversation.getLocalPresentation(sessionKey);
  const recipientLabel =
    detail.data?.recipientLabel ?? localPresentation?.recipientLabel ?? "";
  const subject = detail.data?.subject ?? localPresentation?.subject ?? "";
  const solved = detail.data?.solved ?? false;

  useEffect(() => {
    if (sessionKey === null) return;
    const targetId = activeConversation.consumeScrollRequest(
      sessionKey,
      sideKey
    );
    if (!targetId) return;
    messageRefs.current.get(targetId)?.scrollIntoView?.({ block: "center" });
  }, [activeConversation, detail.dataUpdatedAt, messages, sessionKey, sideKey]);

  useEffect(() => {
    if (
      sessionKey !== null &&
      activeConversation.consumeComposerFocus(sessionKey, sideKey)
    ) {
      composerRef.current?.focus();
    }
  }, [activeConversation, sessionKey, sideKey, statusMutation.status]);

  const executeEnvelope = (envelope: MutationEnvelope | null) => {
    if (!envelope) return;
    if (envelope.kind === "create") {
      createMutation.mutate(envelope);
    } else if (envelope.kind === "reply") {
      replyMutation.mutate(envelope);
    } else {
      statusMutation.mutate(envelope);
    }
  };

  const submitReply = (html: string) => {
    if (
      !tenantId ||
      !agentEmail ||
      !sideKey ||
      !parentKey ||
      sessionKey === null
    ) {
      return;
    }

    activeConversation.setDraftHtml(html);
    executeEnvelope(
      activeConversation.sendReply({
        tenantId,
        parentKey,
        sideKey,
        sessionKey,
        agentEmail,
        canonicalMessages,
        solved,
      })
    );
  };

  const lifecycleParams =
    tenantId && sideKey && parentKey && sessionKey !== null
      ? {
          tenantId,
          parentKey,
          sideKey,
          sessionKey,
          solved,
        }
      : null;
  const lifecycleActionLabel = solved ? "Tekrar aç" : "Çözüldü olarak işaretle";

  return (
    <Screen>
      <header className="relative flex min-h-12 items-center gap-2 bg-white px-3 py-2 shadow backdrop-blur">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Görüşme listesine dön"
          onClick={() => {
            if (panelNavigation.requestChatBack()) {
              setDraftDialogOpen(true);
            }
          }}
        >
          <ChevronLeftIcon className="size-5" />
        </Button>

        <ScreenTitle className="min-w-0 flex-1 truncate text-center text-sm font-semibold">
          {recipientLabel} · {subject}
        </ScreenTitle>

        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Görüşme seçenekleri"
          aria-expanded={menuOpen}
          disabled={!sideKey || detail.isPending || detail.isError}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <DotsHorizontalIcon className="size-5" />
        </Button>

        {menuOpen && (
          <div
            role="menu"
            aria-label="Görüşme işlemleri"
            className="absolute right-3 top-11 z-10 min-w-52 rounded-md border border-border bg-card p-1 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              aria-label={lifecycleActionLabel}
              disabled={activeConversation.lifecyclePending !== null}
              className="w-full rounded px-3 py-2 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
              onClick={() => {
                setMenuOpen(false);
                if (!lifecycleParams) return;
                if (solved) {
                  executeEnvelope(activeConversation.reopen(lifecycleParams));
                } else {
                  setSolveDialogOpen(true);
                }
              }}
            >
              {lifecycleActionLabel}
            </button>
          </div>
        )}
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {solved && (
          <div
            role="status"
            className="border-b border-border bg-muted px-4 py-2 text-center text-sm font-medium text-muted-foreground"
          >
            Çözüldü
          </div>
        )}

        {activeConversation.lifecycleError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 border-b border-destructive/20 bg-destructive/5 px-4 py-2 text-xs text-destructive"
          >
            <span>İşlem tamamlanamadı.</span>
            <button
              type="button"
              aria-label="Yaşam döngüsü işlemini tekrar dene"
              className="font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onClick={() =>
                executeEnvelope(activeConversation.retryLifecycle())
              }
            >
              Tekrar dene
            </button>
          </div>
        )}

        {activeConversation.lifecyclePending && (
          <div
            role="status"
            className="border-b border-border bg-muted/60 px-4 py-2 text-center text-xs text-muted-foreground"
          >
            İşlem sürüyor…
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto bg-background">
          {sideKey && detail.isPending && (
            <div
              role="status"
              className="flex h-full items-center justify-center gap-2 p-6 text-sm text-muted-foreground"
            >
              <ReloadIcon className="size-4 animate-spin" />
              <span>Görüşme yükleniyor</span>
            </div>
          )}

          {sideKey && detail.isError && (
            <div
              role="alert"
              className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
            >
              <p className="text-sm text-destructive">
                Görüşme yüklenemedi. Lütfen tekrar deneyin.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label="Görüşmeyi tekrar yükle"
                onClick={() => void detail.refetch()}
              >
                Tekrar dene
              </Button>
            </div>
          )}

          {(!sideKey || (!detail.isPending && !detail.isError)) &&
            (messages.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Henüz mesaj yok.
              </p>
            ) : (
              messagePresentation(messages).map(
                ({ message, showFullSender }) => (
                  <div
                    key={message.id}
                    ref={(node) => {
                      if (node) messageRefs.current.set(message.id, node);
                      else messageRefs.current.delete(message.id);
                    }}
                  >
                    <ThreadMessage
                      message={message}
                      showFullSender={showFullSender}
                      onRetry={(clientMessageId) =>
                        executeEnvelope(
                          activeConversation.getRetryEnvelope(clientMessageId)
                        )
                      }
                    />
                  </div>
                )
              )
            ))}
        </div>

        <RichTextComposer
          ref={composerRef}
          value={activeConversation.draftHtml}
          recipientLabel={recipientLabel}
          disabled={
            solved ||
            !tenantId ||
            !agentEmail ||
            !sideKey ||
            detail.isPending ||
            detail.isError
          }
          onChange={(html) => activeConversation.setDraftHtml(html)}
          onSubmit={submitReply}
        />
      </main>

      {solveDialogOpen && lifecycleParams && (
        <ConfirmDialog
          title="Çözüldü olarak işaretle"
          body={SOLVE_CONFIRMATION}
          cancelLabel="Vazgeç"
          confirmLabel="Çözmeyi onayla"
          onCancel={() => setSolveDialogOpen(false)}
          onConfirm={() => {
            setSolveDialogOpen(false);
            executeEnvelope(activeConversation.setSolved(lifecycleParams));
          }}
        />
      )}

      {draftDialogOpen && (
        <ConfirmDialog
          title="Taslak kaybolacak"
          body="Gönderilmemiş yanıt taslağın silinecek."
          cancelLabel="Kalsın"
          confirmLabel="Taslağı sil"
          onCancel={() => setDraftDialogOpen(false)}
          onConfirm={() => {
            panelNavigation.confirmDiscardReplyAndReturnToList();
            setDraftDialogOpen(false);
          }}
        />
      )}
    </Screen>
  );
});
