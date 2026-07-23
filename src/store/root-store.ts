import { CurrentUserStore } from "./current-user-store";
import { SideConversationsStore } from "./side-conversations-store";

export class RootStore {
  currentUser: CurrentUserStore;
  sideConversations: SideConversationsStore;

  constructor() {
    this.currentUser = new CurrentUserStore(this);
    this.sideConversations = new SideConversationsStore(this);
  }
}
