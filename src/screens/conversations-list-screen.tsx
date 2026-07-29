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

    const rowKey = panelNavigation.consumeListFocusRequest();
    if (!rowKey) return;

    (rowRefs.current.get(rowKey) ?? createActionRef.current)?.focus();
  }, [list.isPending, list.rows, panelNavigation]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Screen>
      <ScreenHeader>
        {/* w-full: the header's title container is `line-clamp-2`
            (-webkit-box), which sizes single flex children to their
            content by default — w-full keeps the "+" pinned to the
            right edge instead of hugging the title (COMP-01, D-01). */}
        <div className="flex w-full items-center justify-between">
          <ScreenTitle>Yan Görüşmeler</ScreenTitle>
          <Button
            ref={createActionRef}
            size="icon"
            variant="ghost"
            aria-label="Yeni görüşme başlat"
            onClick={() => panelNavigation.openCompose()}
          >
            <PlusIcon className="size-5" />
          </Button>
        </div>
      </ScreenHeader>
      <ScreenContent>
        <div className="flex h-full flex-col gap-2 p-4">
          {list.isPending && (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          )}

          {!list.isPending && !list.isError && list.rows.length > 0 && (
            <>
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
              <ListFooter
                hasMore={list.hasNextPage}
                loading={list.isFetchingNextPage}
                onLoadMore={() => void list.fetchNextPage()}
              />
            </>
          )}

          {!list.isPending && !list.isError && list.rows.length === 0 && (
            <EmptyState />
          )}

          {list.isError && (
            <ErrorCard
              error={list.error as NetworkError | HttpError | null}
              onRetry={() => void list.refetch()}
            />
          )}
        </div>
      </ScreenContent>
    </Screen>
  );
});
