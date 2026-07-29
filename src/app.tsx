import { GrispiProvider, useGrispi } from "./contexts/grispi-context";
import { StoreProvider, useStore } from "./contexts/store-context";
import { ChatScreen } from "./screens/chat-screen";
import { ConfirmDialog } from "./screens/components/confirm-dialog";
import { ComposeScreen } from "./screens/compose-screen";
import { ConversationsListScreen } from "./screens/conversations-list-screen";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";

/**
 * Screen-swap wiring (COMP-01) — no router, same single-screen-panel
 * pattern Phase 1 established (see 02-PATTERNS.md). Must live INSIDE
 * StoreProvider/GrispiProvider since it reads `useStore()`/`useGrispi()`
 * (MobX stores can't read React context themselves — RESEARCH.md Pattern 5).
 *
 * D-03: bridges `useGrispi().ticket?.key` changes into
 * `panelNavigation.handleParentTicketChanged`, the SAME `[ticket?.key]`
 * effect-bridge shape `conversations-list-screen.tsx` already uses
 * (02-PATTERNS.md). This fires on every parent-ticket change regardless of
 * `screen` — harmless when not on `compose` since the store method itself
 * returns `"no-op"` unless `screen === "compose"`.
 */
const AppContent = observer(() => {
  const { ticket } = useGrispi();
  const panelNav = useStore().panelNavigation;
  const compose = useStore().compose;

  const [parentChangeOpen, setParentChangeOpen] = useState(false);

  useEffect(() => {
    if (ticket?.key) {
      const result = panelNav.handleParentTicketChanged(compose.isDirty);
      if (result === "needs-confirm") {
        setParentChangeOpen(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket?.key]);

  const screen = panelNav.screen;

  return (
    <>
      {screen === "list" && <ConversationsListScreen />}
      {screen === "compose" && <ComposeScreen />}
      {screen === "chat" && <ChatScreen />}

      {parentChangeOpen && (
        <ConfirmDialog
          title="Taslağın kaybolacak"
          body="Yeni görüşme taslağın var; talebi değiştirirsen kaybolur."
          cancelLabel="Kalsın"
          confirmLabel="Vazgeç ve devam et"
          onCancel={() => setParentChangeOpen(false)}
          onConfirm={() => {
            compose.reset();
            panelNav.confirmDiscardAndReturnToList();
            setParentChangeOpen(false);
          }}
        />
      )}
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
