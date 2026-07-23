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

import { ConversationRow, SkeletonRow } from "./components/conversation-row";
import { EmptyState } from "./components/empty-state";
import { ErrorCard } from "./components/error-card";
import { ListFooter } from "./components/list-footer";
import { LoadingScreen } from "./loading-screen";

export const ConversationsListScreen = observer(() => {
  const { ticket, loading } = useGrispi();
  const store = useStore().sideConversations;

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
        <ScreenTitle>Yan Görüşmeler</ScreenTitle>
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
