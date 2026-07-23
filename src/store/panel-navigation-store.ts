import { makeAutoObservable } from "mobx";

import { RootStore } from "./root-store";

/**
 * The single panel screen currently rendered by `app.tsx` (screen-swap, no
 * router — same pattern Phase 1 established for its own single-screen
 * bootstrap). Introduced this phase; Phase 1 never needed more than "list".
 */
export type PanelScreen = "list" | "compose" | "chat";

/**
 * Owns list/compose/chat navigation plus the D-02/D-03 dirty-guard return
 * contracts (02-CONTEXT.md, RESEARCH.md Pattern 5 — this is the concrete
 * recommended implementation, not just an example). No generation-guard is
 * needed here (unlike SideConversationsStore.load()): there is no
 * concurrent async fetch racing against itself, just synchronous screen
 * transitions driven by user/SDK events.
 */
export class PanelNavigationStore {
  rootStore: RootStore;
  screen: PanelScreen = "list";

  constructor(rootStore: RootStore) {
    makeAutoObservable(this);
    this.rootStore = rootStore;
  }

  openCompose(): void {
    this.screen = "compose";
  }

  openChat(): void {
    this.screen = "chat";
  }

  /**
   * D-02: back/cancel from compose. Caller (ComposeScreen) supplies whether
   * the form currently has unsaved content. Dirty forms need a confirm
   * dialog — this method does NOT change `screen` in that case and instead
   * returns `true` so the caller can open `ConfirmDialog`. Empty forms
   * return to the list immediately.
   */
  requestBack(isDirty: boolean): boolean {
    if (isDirty) return true;
    this.screen = "list";
    return false;
  }

  /** D-02 confirm path: user explicitly discarded a dirty draft. */
  confirmDiscardAndReturnToList(): void {
    this.screen = "list";
  }

  /**
   * D-03: the active ticket changed (SDK `currentTicketUpdated`/standalone
   * switcher) while the agent may be mid-compose on the PREVIOUS ticket.
   * Only relevant while `screen === "compose"` — any other screen has
   * nothing to protect, hence "no-op". An empty draft closes silently
   * (matches `requestBack`'s empty-form behavior); a dirty draft needs the
   * same confirm dialog as D-02, with different copy, and leaves `screen`
   * unchanged so the agent can keep composing on the original ticket until
   * they decide.
   */
  handleParentTicketChanged(
    isDirty: boolean
  ): "closed-silently" | "needs-confirm" | "no-op" {
    if (this.screen !== "compose") return "no-op";
    if (!isDirty) {
      this.screen = "list";
      return "closed-silently";
    }
    return "needs-confirm";
  }
}
