import { ConversationRow, SkeletonRow } from "./components/conversation-row";
import { EmptyState } from "./components/empty-state";
import { ErrorCard } from "./components/error-card";
import { ListFooter } from "./components/list-footer";
import { LoadingScreen } from "./loading-screen";
import { PlusIcon } from "@radix-ui/react-icons";
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
import { useSideConversationsQuery } from "@/query/side-conversation-queries";

export const ConversationsListScreen = observer(() => {
  const { ticket, tenantId, loading } = useGrispi();
  const panelNavigation = useStore().panelNavigation;
  const list = useSideConversationsQuery(tenantId, ticket?.key ?? null);
  const createActionRef = useRef<HTMLButtonElement>(null);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());

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
          <Button
            ref={createActionRef}
            size="sm"
            variant="ghost"
            aria-label="Yeni konuşma başlat"
            className="gap-1 px-2 text-primary"
            onClick={() => panelNavigation.openCompose()}
          >
            <PlusIcon className="size-4" aria-hidden="true" />
            Yeni konuşma
          </Button>
        }
      />
      <ScreenContent>
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
      </ScreenContent>
    </Screen>
  );
});
