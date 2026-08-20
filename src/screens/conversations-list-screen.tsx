import { ConversationRow, SkeletonRow } from "./components/conversation-row";
import { EmptyState } from "./components/empty-state";
import { ErrorCard } from "./components/error-card";
import { ListFooter } from "./components/list-footer";
import { ParentBanner } from "./components/parent-banner";
import { LoadingScreen } from "./loading-screen";
import { PlusIcon, ReloadIcon } from "@radix-ui/react-icons";
import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  Screen,
  ScreenContent,
  ScreenHeader,
  ScreenTitle,
} from "@/components/ui/screen";
import { useGrispi } from "@/contexts/grispi-context";
import { useStore } from "@/contexts/store-context";
import { HttpError, NetworkError } from "@/grispi/client/http-handler";
import {
  isHydratedTicket,
  isSideConversationTicket,
  parentKeyOfTicket,
} from "@/lib/side-conversation";
import { cn } from "@/lib/utils";
import { useSideConversationsQuery } from "@/query/side-conversation-queries";

const NEW_CONVERSATION_LABEL = "Yeni konuşma başlat";
const NEW_CONVERSATION_BLOCKED_LABEL =
  "Yeni konuşma başlatılamaz — bu talep zaten bir yan konuşma";

export const ConversationsListScreen = observer(() => {
  const { ticket, tenantId, environment, loading } = useGrispi();
  const panelNavigation = useStore().panelNavigation;
  const list = useSideConversationsQuery(tenantId, ticket?.key ?? null);
  const createActionRef = useRef<HTMLButtonElement>(null);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());

  // D-11 — the banner's visibility and the "Yeni konuşma" button's disabled
  // state have OPPOSITE safe directions in the switchTicket hydration-flash
  // window, so they deliberately diverge there.
  //
  // `switchTicket` sets a provisional `{ key }`-only ticket and hydrates in
  // the background WITHOUT flipping the global `loading` flag (documented in
  // grispi-context.tsx). So this screen renders fully while `fieldMap` is
  // still absent, and `isSideConversationTicket` cannot yet tell a normal
  // ticket from a side conversation.
  //
  //   Banner  — fail closed = stay ABSENT. Showing a banner we cannot prove
  //             would be a wrong claim about the active ticket.
  //   Button  — fail closed = stay DISABLED. Leaving it enabled let the agent
  //             click through the window and open a nested side conversation,
  //             which D-11 forbids outright (live UAT bypass, 2026-08-17).
  const isSideConversation = isSideConversationTicket(ticket);
  const parentKey = parentKeyOfTicket(ticket);
  // Unknown counts as blocked: only a hydrated ticket can prove it is safe.
  const blockNewConversation = isSideConversation || !isHydratedTicket(ticket);

  useEffect(() => {
    if (list.isPending) return;

    const target = panelNavigation.consumeListFocusRequest();
    if (!target) return;

    if (target.kind === "row") {
      (rowRefs.current.get(target.key) ?? createActionRef.current)?.focus();
    } else {
      createActionRef.current?.focus();
    }
  }, [list.isPending, list.rows, panelNavigation]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Screen>
      <ScreenHeader
        title={<ScreenTitle>Yan Konuşmalar</ScreenTitle>}
        trailing={
          <>
            {/* Manual refresh (2026-08-17 user request). Deliberately icon-only:
                the header already carries the title and the create action, and
                a third labelled control does not survive the ~280px floor.
                Disabled while a fetch is in flight so a burst of clicks cannot
                queue refetches. Phase 5's SYNC-01 adds automatic background
                refresh; this stays as its manual counterpart. */}
            <Button
              type="button"
              size="header"
              variant="ghost"
              aria-label="Yan konuşmaları yenile"
              title="Yenile"
              disabled={list.isPending || list.isFetching}
              onClick={() => {
                void list.refetch();
              }}
            >
              <ReloadIcon
                className={cn(
                  "size-4",
                  list.isFetching && "animate-spin"
                )}
                aria-hidden="true"
              />
            </Button>
          <Button
            ref={createActionRef}
            size="sm"
            variant="ghost"
            // The blocked label is a claim about the ticket, so it is used
            // ONLY when that claim is proven. During hydration the button is
            // disabled with the normal label — dimmed, but never explaining
            // itself with something we cannot yet know.
            aria-label={
              isSideConversation
                ? NEW_CONVERSATION_BLOCKED_LABEL
                : NEW_CONVERSATION_LABEL
            }
            title={isSideConversation ? NEW_CONVERSATION_BLOCKED_LABEL : undefined}
            disabled={blockNewConversation}
            className="gap-1 px-2 text-primary"
            onClick={() => panelNavigation.openCompose()}
          >
            <PlusIcon className="size-4" aria-hidden="true" />
            <span className="hidden min-[320px]:inline">Yeni konuşma</span>
          </Button>
          </>
        }
      />
      <ScreenContent>
        {isSideConversation && parentKey ? (
          <ParentBanner
            parentKey={parentKey}
            tenantId={tenantId}
            environment={environment}
          />
        ) : (
          <>
            {list.isPending && (
              <div
                role="status"
                aria-label="Yan konuşmalar yükleniyor"
                className="border-y border-border bg-card"
              >
                <span className="sr-only">Yan konuşmalar yükleniyor</span>
                <div className="divide-y divide-border">
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </div>
              </div>
            )}

            {!list.isPending && !list.isError && list.rows.length > 0 && (
              <div className="flex min-h-full flex-col">
                <div
                  role="list"
                  aria-label="Yan konuşmalar"
                  className="border-y border-border bg-card"
                >
                  {list.rows.map((row) => (
                    <ConversationRow
                      key={row.key}
                      ref={(element) => {
                        if (element) {
                          rowRefs.current.set(row.key, element);
                        } else {
                          rowRefs.current.delete(row.key);
                        }
                      }}
                      row={row}
                      onSelect={() => {
                        if (ticket?.key) {
                          panelNavigation.openConversation(
                            row.key,
                            ticket.key,
                            row.key
                          );
                        }
                      }}
                    />
                  ))}
                </div>
                <div className="px-[var(--panel-inset)] py-3">
                  <ListFooter
                    hasMore={list.hasNextPage}
                    loading={list.isFetchingNextPage}
                    onLoadMore={() => void list.fetchNextPage()}
                  />
                </div>
              </div>
            )}

            {!list.isPending && !list.isError && list.rows.length === 0 && (
              <div className="h-full px-[var(--panel-inset)]">
                <EmptyState />
              </div>
            )}

            {list.isError && (
              <div className="px-[var(--panel-inset)] py-4">
                <ErrorCard
                  error={list.error as NetworkError | HttpError | null}
                  onRetry={() => void list.refetch()}
                />
              </div>
            )}
          </>
        )}
      </ScreenContent>
    </Screen>
  );
});
