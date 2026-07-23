import { GrispiProvider } from "./contexts/grispi-context";
import { StoreProvider } from "./contexts/store-context";
import { ConversationsListScreen } from "./screens/conversations-list-screen";

const App = () => {
  return (
    <StoreProvider>
      <GrispiProvider>
        <ConversationsListScreen />
      </GrispiProvider>
    </StoreProvider>
  );
};

export default App;
