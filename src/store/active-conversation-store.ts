import { makeAutoObservable, runInAction } from "mobx";

import { grispiAPI } from "@/grispi/client/api";
import { NetworkError } from "@/grispi/client/http-handler";
import { sanitizeHtml, splitQuotedHtml } from "@/lib/html-sanitizer";
import { getLastSeenAt, setLastSeenAt } from "@/lib/last-seen-store";
import { Comment, CreateTicketRequest, Ticket } from "@/types/grispi.type";

import { RootStore } from "./root-store";

/**
 * A monotonic, purely-client-side id — the optimistic message never needs to
 * be looked up by anything server-generated (the side ticket itself has its
 * own `key`, tracked separately as `ticketKey`). A counter (not
 * `crypto.randomUUID`) keeps this dependency-free and deterministic enough
 * for tests.
 */
let messageIdCounter = 0;
function nextMessageId(): string {
  messageIdCounter += 1;
  return `msg-${messageIdCounter}`;
}

/**
 * Chat message view model (RESEARCH.md "Pattern 4", verbatim seam). Phase 2
 * only ever produces `direction: "own"` — `"incoming"` is reserved for Phase
 * 3's real thread rendering so this shape doesn't need a rewrite later.
 * `errorKind` distinguishes network vs. server failures (T-02-03) without
 * ever carrying the raw `HttpError.body`/`status`.
 */
export interface MessageVM {
  id: string;
  direction: "own" | "incoming";
  body: string;
  status: "pending" | "sent" | "failed";
  createdAt: number;
  errorKind?: "network" | "server";
  senderName?: string;
  senderEmail?: string;
  internal?: boolean;
  quotedHtml?: string;
}

export type ActiveConversationStatus = "idle" | "loading" | "ready" | "error";

export interface StartNewParams {
  recipientLabel: string;
  subject: string;
  body: string;
  request: CreateTicketRequest;
  parentKey: string;
}

/** Payload kept per-message so D-15's retry can re-fire the IDENTICAL POST. */
interface RetryPayload {
  request: CreateTicketRequest;
  parentKey: string;
}

/**
 * Owns the single active side-conversation's optimistic message lifecycle
 * (COMP-04/SYNC-02) — the seam Phase 3 will extend with a real two-way
 * thread (`incoming` messages, `open`/`reply`). `startNew`/`retry` are
 * deliberately synchronous (void), NOT awaited to completion by callers: the
 * pending bubble must exist and the panel must be able to navigate to the
 * chat screen immediately (UI-SPEC "Chat screen anatomy" — bubble mounts
 * `pending` before the POST settles), not after the network round-trip
 * finishes. The POST itself runs in the background via the private
 * `sendCreateTicket`.
 */
export class ActiveConversationStore {
  rootStore: RootStore;
  status: ActiveConversationStatus = "idle";
  loadError: string | null = null;
  ticketKey: string | null = null;
  parentKey: string | null = null;
  recipientLabel = "";
  subject = "";
  solved = false;
  messages: MessageVM[] = [];
  scrollTargetMessageId: string | null = null;
  latestRelevantExternalAt: number | null = null;

  private retryPayloads = new Map<string, RetryPayload>();
  private generation = 0;

  constructor(rootStore: RootStore) {
    makeAutoObservable(this);
    this.rootStore = rootStore;
  }

  /**
   * Starts a brand-new conversation: RESETS all state (`messages`,
   * `ticketKey`, `retryPayloads`) and sets the echoed recipient/subject
   * (Pitfall #6 — these come from compose, never read back from the
   * server) before seeding a single `pending` `MessageVM` and firing the
   * `createTicket` POST in the background.
   *
   * M-4 (UAT fix, 02-06): this store owns exactly ONE active conversation at
   * a time — `startNew` is only ever called for a FRESH conversation
   * (ComposeStore.submit), never to append a reply to the current one
   * (Phase 3's concern). The previous implementation appended to
   * `this.messages`, which bled a prior conversation's bubbles (and its
   * stale `ticketKey`/`retryPayloads`) into a new one: compose to vendor A,
   * back to list, compose to vendor B — B's chat showed A's message too.
   */
  startNew(params: StartNewParams): void {
    const { recipientLabel, subject, body, request, parentKey } = params;

    this.recipientLabel = recipientLabel;
    this.subject = subject;
    this.ticketKey = null;
    this.parentKey = parentKey;
    this.status = "ready";
    this.loadError = null;
    this.solved = false;
    this.scrollTargetMessageId = null;
    this.latestRelevantExternalAt = null;

    const message: MessageVM = {
      id: nextMessageId(),
      direction: "own",
      body,
      status: "pending",
      createdAt: Date.now(),
    };

    // Fresh array (not an append) — a NEW conversation starts with exactly
    // this one message, discarding whatever the PREVIOUS conversation left
    // behind. Still a "new array identity" assignment (same lesson as
    // SideConversationsStore's UAT Defect 2 fix, side-conversations-store.ts
    // lines 443-450) so observers still re-render correctly.
    this.messages = [message];
    this.retryPayloads.clear();
    this.retryPayloads.set(message.id, { request, parentKey });

    void this.sendCreateTicket(message.id);
  }

  /**
   * Loads one canonical side ticket and normalizes its untrusted comments.
   * The generation is bumped synchronously so a slower prior selection can
   * never publish state over the current one.
   */
  async load(ticketKey: string, parentKey: string): Promise<void> {
    const gen = ++this.generation;
    this.status = "loading";
    this.loadError = null;
    this.ticketKey = ticketKey;
    this.parentKey = parentKey;
    this.messages = [];
    this.scrollTargetMessageId = null;
    this.latestRelevantExternalAt = null;

    try {
      const ticket = await grispiAPI.tickets.getTicket(ticketKey);
      if (gen !== this.generation) return;

      const lastSeenAt = getLastSeenAt(ticketKey);
      const messages = [...(ticket.comments ?? [])]
        .sort((a, b) => a.createdAt - b.createdAt || a.id - b.id)
        .map(normalizeComment);
      const externalPublic = messages.filter(
        (message) => message.direction === "incoming" && !message.internal
      );
      const firstUnseen = externalPublic.find(
        (message) => lastSeenAt === null || message.createdAt > lastSeenAt
      );
      const latestRelevantExternalAt =
        externalPublic.length > 0
          ? Math.max(...externalPublic.map((message) => message.createdAt))
          : null;

      runInAction(() => {
        this.messages = messages;
        this.recipientLabel = resolveRecipientLabel(ticket);
        this.subject = resolveSubject(ticket);
        this.solved = resolveStatusId(ticket) === "4";
        this.scrollTargetMessageId =
          firstUnseen?.id ?? messages[messages.length - 1]?.id ?? null;
        this.latestRelevantExternalAt = latestRelevantExternalAt;
        this.status = "ready";
      });

      // Read bookkeeping is deliberately after successful current-generation
      // normalization. It may advance to the latest external timestamp, but
      // must never overwrite a newer local value.
      if (
        latestRelevantExternalAt !== null &&
        (lastSeenAt === null || latestRelevantExternalAt > lastSeenAt)
      ) {
        setLastSeenAt(ticketKey, latestRelevantExternalAt);
      }

      // The list owns independent unseen/action derivation. Storage or list
      // refresh failure must not turn a canonical thread load into an error.
      try {
        await this.rootStore.sideConversations.load(parentKey);
      } catch {
        // SideConversationsStore normally contains its own safe error state.
      }
    } catch {
      if (gen !== this.generation) return;
      runInAction(() => {
        this.status = "error";
        this.loadError = "Görüşme yüklenemedi. Lütfen tekrar deneyin.";
      });
    }
  }

  /**
   * D-15 (locked decision): retry re-fires the EXACT SAME POST rather than
   * rebuilding the request — the API has no idempotency key, so a second
   * side ticket on retry-after-a-transient-failure is an accepted risk
   * (T-02-08, see SUMMARY "Deviations"/"Accepted Risks").
   */
  retry(messageId: string): void {
    const payload = this.retryPayloads.get(messageId);
    if (!payload) return;

    this.messages = this.messages.map((m) =>
      m.id === messageId
        ? { ...m, status: "pending" as const, errorKind: undefined }
        : m
    );

    void this.sendCreateTicket(messageId);
  }

  resolveSent(messageId: string): void {
    this.messages = this.messages.map((m) =>
      m.id === messageId ? { ...m, status: "sent" as const } : m
    );
  }

  /** Body is preserved verbatim (D-15) — only `status`/`errorKind` change. */
  markFailed(messageId: string, errorKind: "network" | "server"): void {
    this.messages = this.messages.map((m) =>
      m.id === messageId ? { ...m, status: "failed" as const, errorKind } : m
    );
  }

  /**
   * The actual `createTicket` POST (COMP-04). On success: resolves the
   * bubble, records the new side ticket's `.key` (CONFIRMED live —
   * `02-01-SUMMARY.md` "Probe Findings" A1, top-level `key` field), and
   * triggers SYNC-02's real refetch (`sideConversations.load(parentKey)`) so
   * the list is never updated with an optimistic fake row (D-16). On
   * failure: only `errorKind` is kept (`error.body`/`status` are NEVER
   * rendered or logged — T-02-03/V7); the list is NOT refetched.
   */
  private async sendCreateTicket(messageId: string): Promise<void> {
    const payload = this.retryPayloads.get(messageId);
    if (!payload) return;

    try {
      const response = await grispiAPI.tickets.createTicket(payload.request);

      runInAction(() => {
        this.resolveSent(messageId);
        this.ticketKey = response.key;
      });

      await this.rootStore.sideConversations.load(payload.parentKey);
    } catch (err) {
      runInAction(() => {
        this.markFailed(messageId, err instanceof NetworkError ? "network" : "server");
      });
    }
  }
}

function isExternal(comment: Comment): boolean {
  return comment.creator?.role?.authority === "ROLE_END_USER";
}

function normalizeComment(comment: Comment): MessageVM {
  const sanitized = sanitizeHtml(comment.body ?? "");
  const quoted = splitQuotedHtml(sanitized);

  return {
    id: `comment-${comment.id}`,
    direction: isExternal(comment) ? "incoming" : "own",
    body: sanitized,
    status: "sent",
    createdAt: comment.createdAt,
    senderName: comment.creator?.fullName || undefined,
    senderEmail: comment.creator?.email || undefined,
    internal: !comment.publicVisible,
    quotedHtml: quoted.quotedHtml,
  };
}

function resolveRecipientLabel(ticket: Ticket): string {
  const requesterId = Number(ticket.fieldMap?.["ts.requester"]?.value);
  const creator = (ticket.comments ?? []).find(
    (comment) =>
      comment.creator?.id === requesterId &&
      comment.creator?.role?.authority === "ROLE_END_USER"
  )?.creator;
  if (!creator) return "—";

  const name = creator.fullName?.trim();
  const email = creator.email?.trim();
  if (name && email) return `${name} <${email}>`;
  return name || email || "—";
}

function resolveSubject(ticket: Ticket): string {
  const value = ticket.fieldMap?.["ts.subject"]?.value;
  return typeof value === "string" ? value : "";
}

function resolveStatusId(ticket: Ticket): string | null {
  const value = ticket.fieldMap?.["ts.status"]?.value;
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (value && typeof value === "object" && "id" in value) {
    return String((value as { id: unknown }).id);
  }
  return null;
}
