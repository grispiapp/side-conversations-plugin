import { observer } from "mobx-react-lite";

import {
  Screen,
  ScreenContent,
  ScreenHeader,
  ScreenTitle,
} from "@/components/ui/screen";
import { useStore } from "@/contexts/store-context";

/**
 * Minimal chat shell stub. Exists only so `screen === "chat"` renders
 * without crashing app.tsx's conditional render (Task 3, COMP-01) — real
 * header meta (recipient · subject) and the optimistic MessageBubble
 * state machine (pending/sent/failed) land in Plan 04/05, see
 * 02-UI-SPEC.md "Chat screen anatomy".
 */
export const ChatScreen = observer(() => {
  const panelNav = useStore().panelNavigation;

  return (
    <Screen>
      <ScreenHeader
        onBack={() => panelNav.confirmDiscardAndReturnToList()}
      >
        <ScreenTitle>Görüşme</ScreenTitle>
      </ScreenHeader>
      <ScreenContent />
    </Screen>
  );
});
