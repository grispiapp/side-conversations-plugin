import { ConfirmDialog } from "./components/confirm-dialog";
import { RichTextComposer } from "./components/rich-text-composer";
import { ThreadMessage } from "./components/thread-message";
import {
  CheckCircledIcon,
  DotsHorizontalIcon,
  LockClosedIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Screen,
  ScreenContent,
  ScreenHeader,
  ScreenTitle,
} from "@/components/ui/screen";
import { useGrispi } from "@/contexts/grispi-context";
import { useStore } from "@/contexts/store-context";
import { rejectionToastLines } from "@/lib/attachment-format";
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
  const attachmentUpload = store.attachmentUpload;
  const panelNavigation = store.panelNavigation;
  const selected = panelNavigation.selectedConversation;
  const { tenantId, agentEmail } = useGrispi();
  const sideKey = selected?.ticketKey ?? null;
  const parentKey = selected?.parentKey ?? null;
  const sessionKey = selected?.sessionKey ?? null;
  const getSelectedConversation = useCallback(
    () => panelNavigation.selectedConversation,
    [panelNavigation]
  );

  const boundary: MutationBoundary = {
    activeConversation,
    getSelectedConversation,
    bindCreatedTicket: (selectedSessionKey, createdSideKey) =>
      panelNavigation.bindCreatedTicket(selectedSessionKey, createdSideKey),
  };
  const detail = useSideConversationDetailQuery(
    tenantId,
    sideKey,
    parentKey,
    sessionKey,
    activeConversation,
    getSelectedConversation
  );
  const createMutation = useCreateSideConversationMutation(boundary);
  const replyMutation = useReplySideConversationMutation(boundary);
  const statusMutation = useStatusSideConversationMutation(boundary);

  const [menuOpen, setMenuOpen] = useState(false);
  const [solveDialogOpen, setSolveDialogOpen] = useState(false);
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const messageRefs = useRef(new Map<string, HTMLElement>());
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuItemRef = useRef<HTMLButtonElement | null>(null);

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
  const scrollMessageVersion = messages
    .map((message) => `${message.id}:${message.status}`)
    .join("|");
  const localPresentation =
    sessionKey === null
      ? null
      : activeConversation.getLocalPresentation(sessionKey);
  const recipientLabel =
    detail.data?.recipientLabel ?? localPresentation?.recipientLabel ?? "";
  const subject = detail.data?.subject ?? localPresentation?.subject ?? "";
  const lifecycle =
    detail.data?.lifecycle ?? (detail.data?.solved ? "solved" : "open");
  const solved = lifecycle !== "open";
  const closed = lifecycle === "closed";

  const closeMenu = useCallback((returnFocus = true) => {
    setMenuOpen(false);
    if (returnFocus) menuTriggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    menuItemRef.current?.focus();

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current?.contains(target) ||
        menuTriggerRef.current?.contains(target)
      ) {
        return;
      }
      closeMenu();
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
      } else if (event.key === "Tab") {
        closeMenu(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu, menuOpen]);

  useEffect(() => {
    if (sessionKey === null) return;
    const targetId = activeConversation.consumeScrollRequest(
      sessionKey,
      sideKey
    );
    if (!targetId) return;
    messageRefs.current.get(targetId)?.scrollIntoView?.({ block: "center" });
  }, [
    activeConversation,
    detail.dataUpdatedAt,
    scrollMessageVersion,
    sessionKey,
    sideKey,
  ]);

  useEffect(() => {
    if (
      sessionKey !== null &&
      activeConversation.consumeComposerFocus(sessionKey, sideKey)
    ) {
      composerRef.current?.focus();
    }
  }, [activeConversation, sessionKey, sideKey, statusMutation.status]);

  // Phase 04 Plan 06 (T-04-21): the reply attachment bucket is session-scoped,
  // the same point `ActiveConversationStore.activateSession` already clears
  // `draftHtml` at — switching to a DIFFERENT side conversation must never
  // carry over stale reply chips into the newly selected thread.
  useEffect(() => {
    attachmentUpload.reset("reply");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey, sideKey]);

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

    activeConversation.setAuthoredDraftHtml(html);
    // D-16: computed from the reply surface's attachment bucket against the
    // SAME final body HTML `sendReply` will itself re-sanitize and send —
    // `activeConversation.draftHtml` is exactly what `setAuthoredDraftHtml`
    // just wrote above.
    const attachmentIds = attachmentUpload.collectAttachmentIds(
      "reply",
      activeConversation.draftHtml
    );
    const envelope = activeConversation.sendReply({
      tenantId,
      parentKey,
      sideKey,
      sessionKey,
      agentEmail,
      solved,
      attachmentIds,
    });
    executeEnvelope(envelope);
    // Clear the reply attachment bucket only AFTER the envelope is built —
    // the ids are already baked into the frozen `request` by this point
    // (ActiveConversationStore.sendReply's own doc-comment), so a later
    // retry of THIS envelope is unaffected; the next reply on this same
    // conversation must not start with leftover chips (Phase 04 Plan 06).
    if (envelope) attachmentUpload.reset("reply");
  };

  const handleAttachFiles = (files: File[]) => {
    const rejections = attachmentUpload.addFiles("reply", files);
    if (rejections.length === 0) return;
    // D-11/UI-SPEC §3 — one summary toast per batch, never one per rejected
    // file (avoids pile-up when many files are dropped at once).
    toast.error("Bazı dosyalar eklenmedi", {
      description: (
        <div className="whitespace-pre-line">
          {rejectionToastLines(rejections).join("\n")}
        </div>
      ),
      duration: 5000,
    });
  };

  const handleInlineImagePaste = async (
    file: File
  ): Promise<string | undefined> => {
    try {
      const image = await attachmentUpload.uploadInlineImage("reply", file);
      return image.objectUrl;
    } catch {
      // UI-SPEC §7/§8.4 — inline paste failure is a TOAST, never inline (no
      // retry affordance exists for this path, D-14).
      toast.error("Görsel yüklenemedi, editöre eklenemedi.", {
        duration: 4000,
      });
      return undefined;
    }
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
      <ScreenHeader
        title={
          <ScreenTitle className="text-sm">
            {recipientLabel || "Görüşme"}
          </ScreenTitle>
        }
        subtitle={`Konu: ${subject || "Konu yok"}`}
        onBack={() => {
          if (panelNavigation.requestChatBack()) {
            setDraftDialogOpen(true);
          }
        }}
        backLabel="Görüşme listesine dön"
        trailing={
          <div className="relative">
            <Button
              ref={menuTriggerRef}
              type="button"
              size="header"
              variant="ghost"
              aria-label="Görüşme seçenekleri"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              disabled={
                !sideKey || detail.isPending || detail.isError || closed
              }
              onClick={() => {
                if (menuOpen) closeMenu();
                else setMenuOpen(true);
              }}
            >
              <DotsHorizontalIcon className="size-5" aria-hidden="true" />
            </Button>

            {menuOpen && (
              <div
                ref={menuRef}
                role="menu"
                aria-label="Görüşme işlemleri"
                className="absolute right-0 top-full z-20 mt-1 min-w-56 rounded-md border border-border bg-card p-1 shadow-lg"
                onBlur={(event) => {
                  const nextFocus = event.relatedTarget as Node | null;
                  if (nextFocus && menuRef.current?.contains(nextFocus)) return;
                  closeMenu(false);
                }}
              >
                <button
                  ref={menuItemRef}
                  type="button"
                  role="menuitem"
                  aria-label={lifecycleActionLabel}
                  disabled={activeConversation.lifecyclePending !== null}
                  className="min-h-11 w-full rounded px-3 py-2 text-left text-sm font-semibold hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-50"
                  onKeyDown={(event) => {
                    if (
                      event.key === "ArrowDown" ||
                      event.key === "ArrowUp" ||
                      event.key === "Home" ||
                      event.key === "End"
                    ) {
                      event.preventDefault();
                      menuItemRef.current?.focus();
                    }
                  }}
                  onClick={() => {
                    closeMenu();
                    if (!lifecycleParams) return;
                    if (solved) {
                      executeEnvelope(
                        activeConversation.reopen(lifecycleParams)
                      );
                    } else {
                      setSolveDialogOpen(true);
                    }
                  }}
                >
                  {lifecycleActionLabel}
                </button>
              </div>
            )}
          </div>
        }
      />

      <ScreenContent
        role="main"
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        {solved && (
          <div
            role="status"
            className="border-b border-border bg-muted px-4 py-2 text-center text-sm font-medium text-muted-foreground"
          >
            {closed ? "Kapalı" : "Çözüldü"}
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
              className="min-h-11 shrink-0 rounded-md px-2 font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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

        <div className="min-h-0 flex-1 overflow-y-auto bg-muted/30">
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
              <p
                role="status"
                className="p-6 text-center text-sm text-muted-foreground"
              >
                Henüz mesaj yok.
              </p>
            ) : (
              <div
                role="feed"
                aria-label="Görüşme mesajları"
                className="space-y-2 p-3"
              >
                {messagePresentation(messages).map(
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
                )}
              </div>
            ))}
        </div>

        {solved ? (
          <section
            aria-label="Yanıt yazma durumu"
            className="shrink-0 border-t border-border bg-card px-4 py-3"
          >
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm">
                {closed ? (
                  <LockClosedIcon className="size-4" aria-hidden="true" />
                ) : (
                  <CheckCircledIcon className="size-4" aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {closed
                    ? "Bu görüşme kapalı."
                    : "Yanıt yazmak için görüşmeyi tekrar açın."}
                </p>
                {!closed && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Açtıktan sonra alıcıya yeni bir e-posta gönderebilirsiniz.
                  </p>
                )}
              </div>
              {!closed && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  disabled={
                    !lifecycleParams ||
                    activeConversation.lifecyclePending !== null
                  }
                  onClick={() => {
                    if (!lifecycleParams) return;
                    executeEnvelope(activeConversation.reopen(lifecycleParams));
                  }}
                >
                  {activeConversation.lifecyclePending === "reopen"
                    ? "Açılıyor…"
                    : "Tekrar aç"}
                </Button>
              )}
            </div>
          </section>
        ) : (
          <RichTextComposer
            ref={composerRef}
            value={activeConversation.draftHtml}
            valueIsTrustedAuthored
            recipientLabel={recipientLabel}
            recipientPrefix="Yanıt:"
            placeholder="Yanıtınızı yazın…"
            disabled={
              !tenantId ||
              !agentEmail ||
              !sideKey ||
              detail.isPending ||
              detail.isError
            }
            onChange={(html) => activeConversation.setAuthoredDraftHtml(html)}
            onSubmit={submitReply}
            className="shrink-0"
            attachments={attachmentUpload.chips("reply")}
            attachmentsUploading={attachmentUpload.isUploading("reply")}
            onAttachFiles={handleAttachFiles}
            onRemoveAttachment={(chipId) =>
              attachmentUpload.removeChip("reply", chipId)
            }
            onRetryAttachment={(chipId) =>
              attachmentUpload.retryChip("reply", chipId)
            }
            onInlineImagePaste={handleInlineImagePaste}
          />
        )}
      </ScreenContent>

      {solveDialogOpen && lifecycleParams && (
        <ConfirmDialog
          title="Çözüldü olarak işaretle"
          body={SOLVE_CONFIRMATION}
          cancelLabel="Vazgeç"
          confirmLabel="Çözüldü olarak işaretle"
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
          tone="danger"
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
