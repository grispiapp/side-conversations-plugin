import { makeAutoObservable, runInAction } from "mobx";

import { grispiAPI } from "@/grispi/client/api";
import { isValidEmail } from "@/lib/side-conversation";
import { Customer } from "@/types/grispi.type";

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

  private searchGeneration = 0;
  private debounceHandle: ReturnType<typeof setTimeout> | null = null;
  private subjectInitialized = false;

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
    this.subjectInitialized = true;
  }
}
