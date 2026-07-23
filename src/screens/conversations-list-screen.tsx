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
        <div className="flex flex-col gap-2 p-4">
          {store.status === "loading" && (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          )}

          {store.status === "ready" &&
            store.rows.map((row) => <ConversationRow key={row.key} row={row} />)}

          {store.status === "empty" && (
            <p className="truncate text-sm text-muted-foreground">
              Henüz yan görüşme yok
            </p>
          )}

          {store.status === "error" && (
            <p className="truncate text-sm text-muted-foreground">
              Yan görüşmeler yüklenemedi
            </p>
          )}
        </div>
      </ScreenContent>
    </Screen>
  );
});
