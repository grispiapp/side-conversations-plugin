import { RootStore } from "./root-store";
import { makeAutoObservable } from "mobx";

import { formatRequesterField } from "@/lib/side-conversation";
import { MutationEnvelope } from "@/store/active-conversation-store";
import { CreateTicketRequest } from "@/types/grispi.type";

export interface CustomerVM {
  id: number;
  name: string | null;
  email: string;
}

/**
 * Owns compose input, selected recipient, subject/message draft, pinned
 * parent and submit guard. Remote customer result/loading/error ownership
 * lives exclusively in the tenant-scoped Query hook.
 */
export class ComposeStore {
  rootStore: RootStore;

  query = "";

  recipientEmail = "";
  recipientLabel = "";

  subject = "";

  message = "";
  submitting = false;

  private subjectInitialized = false;
  /** The value `initSubject` first set — `isDirty` compares against this,
   * NOT `""`, so an untouched prefill never counts as a dirty edit. */
  private initialSubject = "";
  /**
   * M-3b (UAT fix, 02-06 — T-02-01's mitigation): the parent ticket key
   * captured the moment THIS compose session began (set alongside
   * `initSubject`, guarded by the same `subjectInitialized` one-shot). The
   * plugin cannot command the host to revert an in-flight ticket switch, so
   * D-03's "Kalsın" ("stay in compose") is implemented as PINNING instead —
   * `submit` prefers this pinned key over whatever LIVE `parentKey` the
   * caller passes, so a dirty draft always posts to the ticket it was
   * started for, never a parent that changed underneath it mid-compose.
   */
  private pinnedParentKey: string | null = null;
  /** Reserved generation counter for `submit`, mirroring the same
   * generation-guard convention used by `runSearch`/`load` elsewhere in the
   * codebase — the actual reentrancy gate is the synchronous `submitting`
   * check below (D-17), since only one submit can ever be in flight. */
  private submitGeneration = 0;

  constructor(rootStore: RootStore) {
    makeAutoObservable(this);
    this.rootStore = rootStore;
  }

  setQuery(value: string): void {
    this.query = value;
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
   * One-time subject prefill (D-08/D-09) that ALSO pins the compose
   * session's parent ticket key (M-3b). Guarded so a re-mount or a
   * changed-but-still-truthy `ticket?.key` effect dependency never
   * clobbers text the agent has already started editing — and, by the same
   * guard, never re-pins to a parent that changed mid-session (that's
   * exactly the scenario D-03 protects against).
   */
  initSubject(value: string, parentKey: string): void {
    if (this.subjectInitialized) return;
    this.subject = value;
    this.initialSubject = value;
    this.subjectInitialized = true;
    this.pinnedParentKey = parentKey;
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
   * M-3b (UAT fix): the LIVE `parentKey` argument is only a fallback — if
   * this session PINNED a parent (`initSubject`), that pinned key wins.
   * Without this, a dirty draft that survived D-03's "Kalsın" (which only
   * closes the confirm dialog, since the plugin can't command the host to
   * revert `useGrispi().ticket.key`) would silently rebind to whatever
   * parent is now live, contradicting D-03/T-02-01's "no unconfirmed
   * rebinding" guarantee. When no parent change ever happened, the pinned
   * key equals the live key, so the ordinary happy path is unaffected.
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
  async submit(
    tenantId: string | null,
    agentEmail: string | null,
    parentKey: string,
    sessionKey: number
  ): Promise<MutationEnvelope | null> {
    if (this.submitting) return null; // D-17 — before any await
    this.submitting = true;

    // D-10: recipient + message are required; subject may be empty (the
    // live API rejects an EMPTY VALUE, not an empty subject that was never
    // typed — `ts.subject`'s key is still always sent below, Pitfall #1).
    if (
      !tenantId ||
      !agentEmail ||
      !this.recipientEmail ||
      !this.message.trim()
    ) {
      this.submitting = false;
      return null;
    }

    this.submitGeneration += 1;

    const effectiveParentKey = this.pinnedParentKey ?? parentKey;

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
        { key: "tu.side_conversation_parent", value: effectiveParentKey },
      ],
    };

    const envelope = this.rootStore.activeConversation.startNew({
      tenantId,
      recipientLabel: this.recipientLabel,
      subject: this.subject,
      body: this.message,
      request,
      parentKey: effectiveParentKey,
      sessionKey,
    });

    await Promise.resolve();

    this.reset();
    return envelope;
  }

  /**
   * Clears the entire form back to its pristine state. Called internally
   * after a successful `submit`, and externally by ComposeScreen's D-02
   * `ConfirmDialog` "Vazgeç" confirm handler when the agent explicitly
   * discards a dirty draft (Plan 06) — hence public, not private.
   */
  reset(): void {
    this.query = "";
    this.recipientEmail = "";
    this.recipientLabel = "";
    this.subject = "";
    this.initialSubject = "";
    this.subjectInitialized = false;
    this.pinnedParentKey = null;
    this.message = "";
    this.submitting = false;
  }
}
