import { DevTicketSwitcher } from "./components/dev-ticket-switcher";
import { GrispiProvider } from "./contexts/grispi-context";
import { StoreProvider } from "./contexts/store-context";
import { ConversationsListScreen } from "./screens/conversations-list-screen";

const App = () => {
  return (
    <StoreProvider>
      <GrispiProvider>
        <ConversationsListScreen />
        {/* Renders null outside standalone dev mode. */}
        <DevTicketSwitcher />
      </GrispiProvider>
    </StoreProvider>
  );
};

export default App;
