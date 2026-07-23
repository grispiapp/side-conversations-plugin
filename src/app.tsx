import { observer } from "mobx-react-lite";

import { DevTicketSwitcher } from "./components/dev-ticket-switcher";
import { GrispiProvider } from "./contexts/grispi-context";
import { StoreProvider, useStore } from "./contexts/store-context";
import { ChatScreen } from "./screens/chat-screen";
import { ComposeScreen } from "./screens/compose-screen";
import { ConversationsListScreen } from "./screens/conversations-list-screen";

/**
 * Screen-swap wiring (COMP-01) — no router, same single-screen-panel
 * pattern Phase 1 established (see 02-PATTERNS.md). Must live INSIDE
 * StoreProvider/GrispiProvider since it reads `useStore()`.
 */
const AppContent = observer(() => {
  const screen = useStore().panelNavigation.screen;

  return (
    <>
      {screen === "list" && <ConversationsListScreen />}
      {screen === "compose" && <ComposeScreen />}
      {screen === "chat" && <ChatScreen />}
      {/* Renders null outside standalone dev mode. */}
      <DevTicketSwitcher />
    </>
  );
});

const App = () => {
  return (
    <StoreProvider>
      <GrispiProvider>
        <AppContent />
      </GrispiProvider>
    </StoreProvider>
  );
};

export default App;
