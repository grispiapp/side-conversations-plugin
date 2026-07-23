import { makeAutoObservable, runInAction } from "mobx";

import { grispiAPI } from "@/grispi/client/api";
import { formatRequesterField, isValidEmail } from "@/lib/side-conversation";
import { Customer, CreateTicketRequest } from "@/types/grispi.type";

import { RootStore } from "./root-store";

/**
 * The recipient-search debounce window (COMP-02, RESEARCH.md "Pattern 1").
 * 300ms is short enough to feel live while still collapsing per-keystroke
 * calls against the live `customers.search` endpoint into a single request.
 */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * `customers.search` 422s below this length ("Search term must be at least
 * '3' characters long.", CONFIRMED live — see 02-01-SUMMARY.md "New
 * constraint"). The debounce must never fire a call shorter than this.
 */
const MIN_SEARCH_TERM_LENGTH = 3;

const SEARCH_PAGE_SIZE = 10;

export type SearchStatus =
  | "idle"
  | "loading"
  | "results"
  | "no-results"
  | "invalid";

/**
 * Recipient-field view model — only the fields the dropdown actually renders
 * (`fullName`/`email`), narrowed from the live-probed `Customer` shape (see
 * `02-01-SUMMARY.md` "Probe Findings" A3).
 */
export interface CustomerVM {
  id: number;
  name: string | null;
  email: string;
}

function toCustomerVM(customer: Customer): CustomerVM {
  return {
    id: customer.id,
    name: customer.fullName,
    email: customer.email,
  };
}

/**
 * Owns the compose form's recipient search (COMP-02) and prefilled subject
 * (COMP-03). The search half adapts `SideConversationsStore.load()`'s
 * generation-guard debounce pattern (RESEARCH.md "Pattern 1", verbatim) to a
 * user-typed query instead of a ticket-key-triggered fetch — a slower,
 * earlier keystroke's response must never overwrite a faster, later one's
 * (same race Pitfall #6 already documents for the list store).
 */
export class ComposeStore {
  rootStore: RootStore;

  query = "";
  searchStatus: SearchStatus = "idle";
  results: CustomerVM[] = [];

  recipientEmail = "";
  recipientLabel = "";

  subject = "";

  message = "";
  submitting = false;

  private searchGeneration = 0;
  private debounceHandle: ReturnType<typeof setTimeout> | null = null;
  private subjectInitialized = false;
  /** The value `initSubject` first set — `isDirty` compares against this,
   * NOT `""`, so an untouched prefill never counts as a dirty edit. */
  private initialSubject = "";
  /** Reserved generation counter for `submit`, mirroring the same
   * generation-guard convention used by `runSearch`/`load` elsewhere in the
   * codebase — the actual reentrancy gate is the synchronous `submitting`
   * check below (D-17), since only one submit can ever be in flight. */
  private submitGeneration = 0;

  constructor(rootStore: RootStore) {
    makeAutoObservable(this);
    this.rootStore = rootStore;
  }

  /**
   * Drives the recipient input. Debounces (300ms) and gates on the live
   * 3-character `searchTerm` minimum (D-04) — a shorter query never reaches
   * the network and resets straight back to "idle" so the dropdown panel
   * disappears immediately instead of showing a stale "loading"/"results".
   */
  setQuery(value: string): void {
    this.query = value;

    if (this.debounceHandle !== null) {
      clearTimeout(this.debounceHandle);
      this.debounceHandle = null;
    }

    if (value.trim().length < MIN_SEARCH_TERM_LENGTH) {
      this.searchStatus = "idle";
      this.results = [];
      return;
    }

    this.debounceHandle = setTimeout(() => {
      void this.runSearch(value);
    }, SEARCH_DEBOUNCE_MS);
  }

  /**
   * Generation-guard debounced search (RESEARCH.md "Pattern 1", adapted from
   * `SideConversationsStore.load()` lines 232-300). The error branch is
   * deliberately untyped/unread (T-02-03) — `customers.search` failures
   * degrade to the same generic "no-results" state a zero-match search
   * would show, and `error.body`/`status` are never captured, rendered, or
   * logged.
   */
  private async runSearch(term: string): Promise<void> {
    const gen = ++this.searchGeneration;

    runInAction(() => {
      this.searchStatus = "loading";
    });

    try {
      const response = await grispiAPI.customers.search({
        searchTerm: term,
        size: SEARCH_PAGE_SIZE,
        page: 0,
      });

      if (gen !== this.searchGeneration) return; // stale — a newer query already superseded this one

      const results = response.content.map(toCustomerVM);

      runInAction(() => {
        this.results = results;
        this.searchStatus = results.length ? "results" : "no-results";
      });
    } catch {
      if (gen !== this.searchGeneration) return;

      runInAction(() => {
        this.searchStatus = "no-results";
      });
    }
  }

  /**
   * Free-email fallback row visibility (D-05/D-06). Only the CURRENT query
   * is evaluated (not `results`' emptiness) — a valid, unmatched address
   * should offer the free-email row even while other customers also matched
   * the search.
   */
  get showFreeEmailRow(): boolean {
    const trimmed = this.query.trim();
    if (!isValidEmail(trimmed)) return false;
    return !this.results.some((result) => result.email === trimmed);
  }

  /** Selects a matched customer. Falls back to the email when the record
   * carries no name (D-06 fallback — `fullName` is nullable, A3). */
  selectRecipient(vm: CustomerVM): void {
    this.recipientEmail = vm.email;
    this.recipientLabel = vm.name || vm.email;
  }

  /** Selects the typed free-form address (D-05) — label mirrors the email
   * since there is no customer record to source a display name from. */
  selectFreeEmail(email: string): void {
    this.recipientEmail = email;
    this.recipientLabel = email;
  }

  /** Freely, always overwrites — used by the editable subject input. */
  setSubject(value: string): void {
    this.subject = value;
  }

  /**
   * One-time subject prefill (D-08/D-09). Guarded so a re-mount or a
   * changed-but-still-truthy `ticket?.key` effect dependency never
   * clobbers text the agent has already started editing.
   */
  initSubject(value: string): void {
    if (this.subjectInitialized) return;
    this.subject = value;
    this.initialSubject = value;
    this.subjectInitialized = true;
  }

  /** Drives the message textarea (COMP-04). */
  setMessage(value: string): void {
    this.message = value;
  }

  /**
   * True once the agent has entered anything beyond the untouched prefill —
   * recipient selected, a message typed, or the subject edited away from
   * whatever `initSubject` first set (D-02's dirty-guard reads this).
   */
  get isDirty(): boolean {
    if (this.recipientEmail.trim() !== "") return true;
    if (this.message.trim() !== "") return true;
    if (this.subject.trim() !== "" && this.subject !== this.initialSubject) {
      return true;
    }
    return false;
  }

  /**
   * Builds the `createTicket` request and hands it to
   * `ActiveConversationStore.startNew` (COMP-04). `agentEmail`/`parentKey`
   * come from `useGrispi()` — the store never reads React context itself,
   * so the caller (MessageField's Shift+Enter / Plan 05's "Gönder" button)
   * passes them through (T-02-05: `agentEmail` only ever flows FROM the
   * trusted SDK context, never from a form field).
   *
   * D-17 (locked): the reentrancy guard is a SYNCHRONOUS check before any
   * `await` — a second call made in the same tick (before the first call's
   * `await Promise.resolve()` yields) is a no-op. That single microtask
   * yield is deliberate: `activeConversation.startNew` is fire-and-forget
   * (it does not block on the network POST — see its own doc-comment), so
   * navigating to the chat screen happens right after the optimistic
   * pending bubble is created, not after the POST settles (UI-SPEC "Chat
   * screen anatomy").
   */
  async submit(agentEmail: string | null, parentKey: string): Promise<void> {
    if (this.submitting) return; // D-17 — before any await
    this.submitting = true;

    // D-10: recipient + message are required; subject may be empty (the
    // live API rejects an EMPTY VALUE, not an empty subject that was never
    // typed — `ts.subject`'s key is still always sent below, Pitfall #1).
    if (!this.recipientEmail || !this.message.trim()) {
      this.submitting = false;
      return;
    }

    this.submitGeneration += 1;

    const request: CreateTicketRequest = {
      comment: {
        body: this.message,
        publicVisible: true,
        creator: [{ key: "us.email", value: agentEmail ?? "" }],
      },
      fields: [
        { key: "ts.subject", value: this.subject },
        {
          key: "ts.requester",
          value: formatRequesterField(this.recipientEmail),
        },
        { key: "tu.side_conversation_parent", value: parentKey },
      ],
    };

    this.rootStore.activeConversation.startNew({
      recipientLabel: this.recipientLabel,
      subject: this.subject,
      body: this.message,
      request,
      parentKey,
    });

    await Promise.resolve();

    this.rootStore.panelNavigation.openChat();
    this.reset();
  }

  /**
   * Clears the entire form back to its pristine state. Called internally
   * after a successful `submit`, and externally by ComposeScreen's D-02
   * `ConfirmDialog` "Vazgeç" confirm handler when the agent explicitly
   * discards a dirty draft (Plan 06) — hence public, not private.
   */
  reset(): void {
    this.query = "";
    this.searchStatus = "idle";
    this.results = [];
    this.recipientEmail = "";
    this.recipientLabel = "";
    this.subject = "";
    this.initialSubject = "";
    this.subjectInitialized = false;
    this.message = "";
    this.submitting = false;
  }
}
