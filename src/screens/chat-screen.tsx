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
import { MessageVM } from "@/store/active-conversation-store";

import { ConfirmDialog } from "./components/confirm-dialog";
import { RichTextComposer } from "./components/rich-text-composer";
import { ThreadMessage } from "./components/thread-message";

const SOLVE_CONFIRMATION =
  "Görüşme çözüldü olarak işaretlensin mi? Yeni bir e-posta yanıtı gelirse tekrar aktif olur.";

function messagePresentation(
  messages: MessageVM[]
): Array<{ message: MessageVM; showFullSender: boolean }> {
  let externalSeen = false;
  return messages.map((message) => {
    const showFullSender =
      message.direction === "incoming" &&
      !message.internal &&
      !externalSeen;
    if (message.direction === "incoming" && !message.internal) {
      externalSeen = true;
    }
    return { message, showFullSender };
  });
}

/**
 * The complete Phase 3 email-thread screen. The store remains authoritative
 * for loading, reply and lifecycle state; this component only connects those
 * states to the narrow-panel interaction contract.
 */
export const ChatScreen = observer(() => {
  const activeConversation = useStore().activeConversation;
  const panelNavigation = useStore().panelNavigation;
  const { agentEmail } = useGrispi();
  const [menuOpen, setMenuOpen] = useState(false);
  const [solveDialogOpen, setSolveDialogOpen] = useState(false);
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const messageRefs = useRef(new Map<string, HTMLElement>());
  const consumedScrollTarget = useRef<string | null>(null);
  const shouldFocusComposer = activeConversation.consumeComposerFocus();

  useEffect(() => {
    const targetId = activeConversation.scrollTargetMessageId;
    if (!targetId) return;

    const targetKey = `${activeConversation.ticketKey ?? ""}:${targetId}`;
    if (consumedScrollTarget.current === targetKey) return;

    const target = messageRefs.current.get(targetId);
    if (!target) return;

    target.scrollIntoView?.({ block: "center" });
    consumedScrollTarget.current = targetKey;
  }, [
    activeConversation.messages,
    activeConversation.scrollTargetMessageId,
    activeConversation.ticketKey,
  ]);

  useEffect(() => {
    if (shouldFocusComposer) {
      composerRef.current?.focus();
    }
  }, [shouldFocusComposer]);

  const requestBack = () => {
    if (panelNavigation.requestChatBack()) {
      setDraftDialogOpen(true);
    }
  };

  const retryLoad = () => {
    if (activeConversation.ticketKey && activeConversation.parentKey) {
      void activeConversation.load(
        activeConversation.ticketKey,
        activeConversation.parentKey
      );
    }
  };

  const submitReply = (html: string) => {
    if (!agentEmail) return;
    activeConversation.setDraftHtml(html);
    activeConversation.sendReply(agentEmail);
  };

  const lifecycleActionLabel = activeConversation.solved
    ? "Tekrar aç"
    : "Çözüldü olarak işaretle";

  return (
    <Screen>
      <header className="relative flex min-h-12 items-center gap-2 bg-white px-3 py-2 shadow backdrop-blur">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Görüşme listesine dön"
          onClick={requestBack}
        >
          <ChevronLeftIcon className="size-5" />
        </Button>

        <ScreenTitle className="min-w-0 flex-1 truncate text-center text-sm font-semibold">
          {activeConversation.recipientLabel} · {activeConversation.subject}
        </ScreenTitle>

        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Görüşme seçenekleri"
          aria-expanded={menuOpen}
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
                if (activeConversation.solved) {
                  activeConversation.reopen();
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
        {activeConversation.solved && (
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
              onClick={() => activeConversation.retryLifecycle()}
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
          {activeConversation.status === "loading" && (
            <div
              role="status"
              className="flex h-full items-center justify-center gap-2 p-6 text-sm text-muted-foreground"
            >
              <ReloadIcon className="size-4 animate-spin" />
              <span>Görüşme yükleniyor</span>
            </div>
          )}

          {activeConversation.status === "error" && (
            <div
              role="alert"
              className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
            >
              <p className="text-sm text-destructive">
                {activeConversation.loadError ??
                  "Görüşme yüklenemedi. Lütfen tekrar deneyin."}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label="Görüşmeyi tekrar yükle"
                onClick={retryLoad}
              >
                Tekrar dene
              </Button>
            </div>
          )}

          {activeConversation.status === "ready" &&
            (activeConversation.messages.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Henüz mesaj yok.
              </p>
            ) : (
              messagePresentation(activeConversation.messages).map(
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
                      onRetry={(id) => activeConversation.retry(id)}
                    />
                  </div>
                )
              )
            ))}
        </div>

        <RichTextComposer
          ref={composerRef}
          value={activeConversation.draftHtml}
          recipientLabel={activeConversation.recipientLabel}
          disabled={
            activeConversation.solved ||
            activeConversation.status !== "ready" ||
            !agentEmail
          }
          onChange={(html) => activeConversation.setDraftHtml(html)}
          onSubmit={submitReply}
        />
      </main>

      {solveDialogOpen && (
        <ConfirmDialog
          title="Çözüldü olarak işaretle"
          body={SOLVE_CONFIRMATION}
          cancelLabel="Vazgeç"
          confirmLabel="Çözmeyi onayla"
          onCancel={() => setSolveDialogOpen(false)}
          onConfirm={() => {
            setSolveDialogOpen(false);
            activeConversation.setSolved();
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
