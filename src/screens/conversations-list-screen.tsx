import { PlusIcon } from "@radix-ui/react-icons";
import { observer } from "mobx-react-lite";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  Screen,
  ScreenContent,
  ScreenHeader,
  ScreenTitle,
} from "@/components/ui/screen";
import { useGrispi } from "@/contexts/grispi-context";
import { useStore } from "@/contexts/store-context";

import { ConversationRow, SkeletonRow } from "./components/conversation-row";
import { EmptyState } from "./components/empty-state";
import { ErrorCard } from "./components/error-card";
import { ListFooter } from "./components/list-footer";
import { LoadingScreen } from "./loading-screen";

export const ConversationsListScreen = observer(() => {
  const { ticket, loading } = useGrispi();
  const store = useStore().sideConversations;
  const panelNavigation = useStore().panelNavigation;

  useEffect(() => {
    if (ticket?.key) {
      store.load(ticket.key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket?.key]);

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
          {store.status === "loading" && (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          )}

          {store.status === "ready" && (
            <>
              {store.rows.map((row) => (
                <ConversationRow key={row.key} row={row} />
              ))}
              <ListFooter
                hasMore={store.hasMore}
                loading={store.loadingMore}
                onLoadMore={() => store.loadMore()}
              />
            </>
          )}

          {store.status === "empty" && <EmptyState />}

          {store.status === "error" && (
            <ErrorCard
              error={store.error}
              onRetry={() => ticket?.key && store.load(ticket.key)}
            />
          )}
        </div>
      </ScreenContent>
    </Screen>
  );
});
