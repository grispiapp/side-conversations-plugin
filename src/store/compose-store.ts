import { RootStore } from "./root-store";
import { makeAutoObservable } from "mobx";

import {
  CcEntry,
  ccEntryIdentity,
  dedupeCcEntries,
  serializeEmailCcs,
} from "@/lib/email-ccs";
import {
  sanitizeAuthoredHtml,
  sanitizeUntrustedDraftHtml,
} from "@/lib/html-sanitizer";
import { htmlToText } from "@/lib/html-to-text";
import {
  EMAIL_CCS_FIELD_KEY,
  TICKET_BRAND_FIELD_KEY,
  formatRequesterField,
  isValidEmail,
} from "@/lib/side-conversation";
import { MutationEnvelope } from "@/store/active-conversation-store";
import { CreateTicketRequest } from "@/types/grispi.type";

export interface CustomerVM {
  id: number;
  name: string | null;
  email: string | null;
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

  ccEntries: CcEntry[] = [];
  ccQuery = "";

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
   * D-03's stay-in-compose path is implemented as PINNING instead —
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
    const email = vm.email?.trim() ?? "";
    if (!isValidEmail(email)) return;
    this.recipientEmail = email;
    this.recipientLabel = vm.name || email;
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

  setCcQuery(value: string): void {
    this.ccQuery = value;
  }

  addCc(entry: CcEntry): void {
    this.ccEntries = dedupeCcEntries([...this.ccEntries, entry]);
  }

  removeCc(identity: string): void {
    this.ccEntries = this.ccEntries.filter(
      (entry) => ccEntryIdentity(entry) !== identity
    );
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
    this.message = sanitizeUntrustedDraftHtml(value);
  }

  setAuthoredMessage(value: string): void {
    this.message = sanitizeAuthoredHtml(value);
  }

  /**
   * True once the agent has entered anything beyond the untouched prefill —
   * recipient selected, a message typed, the subject edited away from
   * whatever `initSubject` first set, or a file attached (D-02/D-18's
   * dirty-guard reads this). D-18: a non-empty attachment bucket counts as
   * dirty even when text/recipient/subject are all untouched — an agent who
   * attached a file and then tries to navigate away must still see the
   * discard confirmation.
   */
  get isDirty(): boolean {
    if (this.query.trim() !== "") return true;
    if (this.recipientEmail.trim() !== "") return true;
    if (this.subject !== this.initialSubject) return true;
    if (this.ccEntries.length > 0) return true;
    if (this.ccQuery.trim() !== "") return true;
    if (this.rootStore.attachmentUpload.hasAttachments("compose")) return true;
    return htmlToText(sanitizeAuthoredHtml(this.message)) !== "";
  }

  getEffectiveParentKey(parentKey: string): string {
    return this.pinnedParentKey ?? parentKey;
  }

  /**
   * Builds the `createTicket` request and hands it to
   * `ActiveConversationStore.startNew` (COMP-04). `agentEmail`/`parentKey`
   * come from `useGrispi()` — the store never reads React context itself,
   * so the caller (MessageField's Shift+Enter or the submit button)
   * passes them through (T-02-05: `agentEmail` only ever flows FROM the
   * trusted SDK context, never from a form field).
   *
   * M-3b (UAT fix): the LIVE `parentKey` argument is only a fallback — if
   * this session PINNED a parent (`initSubject`), that pinned key wins.
   * Without this, a dirty draft retained by D-03 (which only
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
   *
   * `attachmentIds` (Phase 04 Plan 06, D-16): computed by the CALLER
   * (ComposeScreen), BEFORE this envelope is built — the exact same
   * "store never reads React context, caller passes it through" precedent
   * as `agentEmail`/`parentKey` above, extended to a sibling store read.
   * The caller derives the list from
   * `AttachmentUploadStore.collectAttachmentIds("compose", finalBodyHtml)`,
   * which already performs D-16's submit-time garbage collection (an
   * inline-pasted image whose `objectUrl` no longer appears in the final
   * authored body is dropped). Defaults to `[]` so every pre-Plan-06 caller
   * (and test) keeps compiling without passing a fifth argument.
   *
   * `brandId` (quick-260902-dhy): the PARENT ticket's `ts.brand` value, so
   * the side ticket's mail goes out from that brand's support address rather
   * than the tenant default. Passed by the caller for the same reason as
   * `agentEmail`/`parentKey` — the store never reads React context itself.
   */
  async submit(
    tenantId: string | null,
    agentEmail: string | null,
    parentKey: string,
    sessionKey: number,
    attachmentIds: number[] = [],
    brandId: string | null = null
  ): Promise<Extract<MutationEnvelope, { kind: "create" }> | null> {
    if (this.submitting) return null; // D-17 — before any await
    this.submitting = true;

    const safeBody = sanitizeAuthoredHtml(this.message);
    // D-10: recipient + message are required; subject may be empty (the
    // live API rejects an EMPTY VALUE, not an empty subject that was never
    // typed — `ts.subject`'s key is still always sent below, Pitfall #1).
    if (
      !tenantId ||
      !agentEmail ||
      !this.recipientEmail ||
      htmlToText(safeBody) === ""
    ) {
      this.submitting = false;
      return null;
    }

    this.submitGeneration += 1;

    const effectiveParentKey = this.getEffectiveParentKey(parentKey);

    const request: CreateTicketRequest = {
      comment: {
        body: safeBody,
        publicVisible: true,
        creator: [{ key: "us.email", value: agentEmail ?? "" }],
        channel: "WEB",
        // Omit-when-empty (RESEARCH.md pitfall): never send `[]`, only a
        // real non-empty list or no field at all.
        ...(attachmentIds.length > 0 ? { attachmentIds } : {}),
      },
      fields: [
        { key: "ts.subject", value: this.subject },
        {
          key: "ts.requester",
          value: formatRequesterField(this.recipientEmail),
        },
        { key: "tp.side_conversation_parent", value: effectiveParentKey },
        // Omit-when-empty, same rule as `attachmentIds` above: an unbranded
        // parent must send no `ts.brand` key at all, never an empty value.
        ...(brandId ? [{ key: TICKET_BRAND_FIELD_KEY, value: brandId }] : []),
        // Omit-when-empty (D-CC-6): a fresh ticket with no CC must send no
        // `ts.email_ccs` key at all, never `""`.
        ...(this.ccEntries.length > 0
          ? [
              {
                key: EMAIL_CCS_FIELD_KEY,
                value: serializeEmailCcs(this.ccEntries),
              },
            ]
          : []),
      ],
    };

    const envelope = this.rootStore.activeConversation.startNew({
      tenantId,
      recipientLabel: this.recipientLabel,
      subject: this.subject,
      body: safeBody,
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
   * ConfirmDialog discard handler when the agent explicitly
   * discards a dirty draft (Plan 06) — hence public, not private.
   *
   * Also clears the compose surface's attachment bucket (Phase 04 Plan 06)
   * so a freshly opened "+" compose session — or the very next submission
   * cycle on this same session — never starts with a leftover chip from a
   * prior session (mirrors D-03's message-clearing precedent, applied to
   * attachments). Since `submit` calls this at the end of every successful
   * send, the surface is cleared right after the frozen envelope (and the
   * attachment ids already baked into it) is handed off — a later retry of
   * that SAME envelope still replays its own already-bound ids, untouched
   * by this reset (see `ActiveConversationStore`'s retry doc-comment for
   * the equivalent reply-side reasoning).
   */
  reset(): void {
    this.query = "";
    this.recipientEmail = "";
    this.recipientLabel = "";
    this.subject = "";
    this.initialSubject = "";
    this.subjectInitialized = false;
    this.pinnedParentKey = null;
    this.ccEntries = [];
    this.ccQuery = "";
    this.message = "";
    this.submitting = false;
    this.rootStore.attachmentUpload.reset("compose");
  }
}
