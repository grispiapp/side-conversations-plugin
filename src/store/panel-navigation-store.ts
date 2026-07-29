import { RootStore } from "./root-store";
import { makeAutoObservable } from "mobx";

/**
 * The single panel screen currently rendered by `app.tsx` (screen-swap, no
 * router — same pattern Phase 1 established for its own single-screen
 * bootstrap). Introduced this phase; Phase 1 never needed more than "list".
 */
export type PanelScreen = "list" | "compose" | "chat";

export interface SelectedConversation {
  ticketKey: string | null;
  parentKey: string;
  sessionKey: number;
}

export type ListFocusTarget =
  | { kind: "row"; key: string }
  | { kind: "create-action" };

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
  selectedConversation: SelectedConversation | null = null;

  private selectedConversationSession = 0;
  private navigationFocusOrigin: ListFocusTarget | null = null;
  private listFocusRequest: ListFocusTarget | null = null;

  constructor(rootStore: RootStore) {
    makeAutoObservable(this);
    this.rootStore = rootStore;
  }

  /**
   * M-2/M-3a (UAT fix, 02-06): this is the FRESH-open seam — the only two
   * call sites are the list header "+" and the empty-state CTA, never a
   * "resume the current draft" path (D-03's "Kalsın" keeps `screen`
   * unchanged and never calls this again). `compose.reset()` here
   * guarantees a pristine `ComposeStore` every time compose is opened from
   * the list: without it, a non-dirty back (which does NOT reset — only
   * Vazgeç/submit do) left stale recipient-search text/hint (M-2) and a
   * stale prefilled subject from the PREVIOUS parent ticket (M-3a, since
   * `subjectInitialized` was never cleared).
   */
  openCompose(): void {
    this.rootStore.compose.reset();
    this.navigationFocusOrigin = { kind: "create-action" };
    this.screen = "compose";
  }

  openChat(): void {
    this.screen = "chat";
  }

  reservePendingConversation(parentKey: string): SelectedConversation {
    this.selectedConversationSession += 1;
    this.selectedConversation = {
      ticketKey: null,
      parentKey,
      sessionKey: this.selectedConversationSession,
    };
    this.rootStore.activeConversation.activateSession(
      this.selectedConversation.sessionKey,
      null
    );
    this.navigationFocusOrigin = { kind: "create-action" };
    return this.selectedConversation;
  }

  showPendingConversation(sessionKey: number): boolean {
    if (
      !this.selectedConversation ||
      this.selectedConversation.sessionKey !== sessionKey ||
      this.selectedConversation.ticketKey !== null
    ) {
      return false;
    }
    this.screen = "chat";
    return true;
  }

  openPendingConversation(parentKey: string): SelectedConversation {
    const selected = this.reservePendingConversation(parentKey);
    this.showPendingConversation(selected.sessionKey);
    return selected;
  }

  cancelPendingConversationReservation(sessionKey: number): void {
    if (
      this.screen === "compose" &&
      this.selectedConversation?.sessionKey === sessionKey &&
      this.selectedConversation.ticketKey === null
    ) {
      this.selectedConversation = null;
    }
  }

  bindCreatedTicket(sessionKey: number, sideKey: string): void {
    if (
      !this.selectedConversation ||
      this.selectedConversation.sessionKey !== sessionKey ||
      this.selectedConversation.ticketKey !== null
    ) {
      return;
    }

    this.selectedConversation = {
      ...this.selectedConversation,
      ticketKey: sideKey,
    };
    this.rootStore.activeConversation.activateSession(sessionKey, sideKey);
  }

  /**
   * The row-selection trust boundary. Both keys are captured from the same
   * render so a later host-ticket change cannot redirect thread mutations to
   * a different parent while the canonical load is in flight.
   */
  openConversation(ticketKey: string, parentKey: string, rowKey: string): void {
    this.selectedConversationSession += 1;
    this.selectedConversation = {
      ticketKey,
      parentKey,
      sessionKey: this.selectedConversationSession,
    };
    this.rootStore.activeConversation.activateSession(
      this.selectedConversation.sessionKey,
      ticketKey
    );
    this.navigationFocusOrigin = { kind: "row", key: rowKey };
    this.screen = "chat";
  }

  /**
   * D-12: back from an existing thread has its own dirty guard. It must not
   * reset or inspect ComposeStore because reply and new-conversation drafts
   * are independent sessions with different confirmation copy.
   */
  requestChatBack(): boolean {
    const text = this.rootStore.activeConversation.draftHtml
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;|&#160;/gi, " ")
      .trim();
    if (text) return true;
    this.listFocusRequest = this.navigationFocusOrigin;
    this.screen = "list";
    return false;
  }

  /** D-12 confirm path: explicitly discard only the active reply draft. */
  confirmDiscardReplyAndReturnToList(): void {
    this.rootStore.activeConversation.setDraftHtml("");
    this.listFocusRequest = this.navigationFocusOrigin;
    this.screen = "list";
  }

  consumeListFocusRequest(): ListFocusTarget | null {
    const request = this.listFocusRequest;
    this.listFocusRequest = null;
    return request;
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
    this.listFocusRequest = { kind: "create-action" };
    this.screen = "list";
    return false;
  }

  /** D-02 confirm path: user explicitly discarded a dirty draft. */
  confirmDiscardAndReturnToList(): void {
    this.listFocusRequest = { kind: "create-action" };
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
      this.listFocusRequest = { kind: "create-action" };
      this.screen = "list";
      return "closed-silently";
    }
    return "needs-confirm";
  }
}
