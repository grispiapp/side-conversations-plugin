import { ActiveConversationStore } from "./active-conversation-store";
import { ComposeStore } from "./compose-store";
import { CurrentUserStore } from "./current-user-store";
import { PanelNavigationStore } from "./panel-navigation-store";

export class RootStore {
  currentUser: CurrentUserStore;
  compose: ComposeStore;
  activeConversation: ActiveConversationStore;
  panelNavigation: PanelNavigationStore;

  constructor() {
    this.currentUser = new CurrentUserStore(this);
    this.compose = new ComposeStore(this);
    this.activeConversation = new ActiveConversationStore(this);
    this.panelNavigation = new PanelNavigationStore(this);
  }
}
