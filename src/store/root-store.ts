import { ActiveConversationStore } from "./active-conversation-store";
import { ComposeStore } from "./compose-store";
import { CurrentUserStore } from "./current-user-store";
import { PanelNavigationStore } from "./panel-navigation-store";
import { SideConversationsStore } from "./side-conversations-store";

export class RootStore {
  currentUser: CurrentUserStore;
  sideConversations: SideConversationsStore;
  compose: ComposeStore;
  activeConversation: ActiveConversationStore;
  panelNavigation: PanelNavigationStore;

  constructor() {
    this.currentUser = new CurrentUserStore(this);
    this.sideConversations = new SideConversationsStore(this);
    this.compose = new ComposeStore(this);
    this.activeConversation = new ActiveConversationStore(this);
    this.panelNavigation = new PanelNavigationStore(this);
  }
}
