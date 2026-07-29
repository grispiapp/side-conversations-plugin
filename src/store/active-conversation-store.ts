import { RootStore } from "./root-store";
import { makeAutoObservable } from "mobx";

import { buildQuotedReplyHtml, sanitizeHtml } from "@/lib/html-sanitizer";
import {
  CreateTicketRequest,
  ReplyTicketPatchRequest,
  StatusTicketPatchRequest,
} from "@/types/grispi.type";

let messageIdCounter = 0;

function nextMessageId(): string {
  messageIdCounter += 1;
  return `msg-${messageIdCounter}`;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);
  Object.values(value as Record<string, unknown>).forEach(deepFreeze);
  return value;
}

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

export type MutationEnvelope =
  | {
      kind: "create";
      clientMessageId: string;
      tenantId: string;
      parentKey: string;
      sideKey?: undefined;
      request: CreateTicketRequest;
      sessionKey: number;
      startedAt: number;
    }
  | {
      kind: "reply";
      clientMessageId: string;
      tenantId: string;
      parentKey: string;
      sideKey: string;
      request: ReplyTicketPatchRequest;
      sessionKey: number;
      startedAt: number;
    }
  | {
      kind: "solve" | "reopen";
      clientMessageId: string;
      tenantId: string;
      parentKey: string;
      sideKey: string;
      request: StatusTicketPatchRequest;
      sessionKey: number;
      startedAt: number;
    };

export interface StartNewParams {
  tenantId: string;
  parentKey: string;
  sessionKey: number;
  recipientLabel: string;
  subject: string;
  body: string;
  request: CreateTicketRequest;
}

export interface ReplyParams {
  tenantId: string;
  parentKey: string;
  sideKey: string;
  sessionKey: number;
  agentEmail: string;
  canonicalMessages: readonly MessageVM[];
  solved?: boolean;
}

export interface LifecycleParams {
  tenantId: string;
  parentKey: string;
  sideKey: string;
  sessionKey: number;
  solved: boolean;
}

export interface LifecycleError {
  action: "solve" | "reopen";
  errorKind: "network" | "server";
  clientMessageId: string;
}

export interface LocalThreadPresentation {
  sessionKey: number;
  recipientLabel: string;
  subject: string;
}

interface OverlayRecord {
  envelope: MutationEnvelope;
  message: MessageVM;
  sideKey: string | null;
  accepted: boolean;
}

interface SessionSignal<T> {
  sessionKey: number;
  sideKey: string | null;
  value: T;
}

function hasMessage(
  envelope: MutationEnvelope
): envelope is Extract<MutationEnvelope, { kind: "create" | "reply" }> {
  return envelope.kind === "create" || envelope.kind === "reply";
}

function envelopeBody(envelope: MutationEnvelope): string | null {
  return hasMessage(envelope)
    ? sanitizeHtml(envelope.request.comment.body)
    : null;
}

function envelopeCreator(envelope: MutationEnvelope): string | null {
  return hasMessage(envelope)
    ? (envelope.request.comment.creator[0]?.value ?? null)
    : null;
}

/**
 * Local-only active-thread state. Canonical ticket data, comments, recipient,
 * subject, solved, loading, and errors belong to React Query. This store owns
 * immutable mutation envelopes, optimistic overlays, draft input, retry
 * lookup, and one-shot session-scoped UI signals.
 */
export class ActiveConversationStore {
  draftHtml = "";
  lifecyclePending: "solve" | "reopen" | null = null;
  lifecycleError: LifecycleError | null = null;

  private activeSessionKey: number | null = null;
  private activeSideKey: string | null = null;
  private overlayRecords: OverlayRecord[] = [];
  private localPresentation: LocalThreadPresentation | null = null;
  private focusRequest: SessionSignal<true> | null = null;
  private scrollRequest: SessionSignal<string> | null = null;
  private envelopes = new Map<string, MutationEnvelope>();
  private matchedCanonicalIds = new Map<string, Set<string>>();

  constructor(_rootStore: RootStore) {
    makeAutoObservable<this, "envelopes" | "matchedCanonicalIds">(
      this,
      {
        envelopes: false,
        matchedCanonicalIds: false,
      },
      { autoBind: true, deep: false }
    );
  }

  activateSession(sessionKey: number, sideKey: string | null): void {
    if (
      this.activeSessionKey === sessionKey &&
      this.activeSideKey === sideKey
    ) {
      return;
    }

    this.activeSessionKey = sessionKey;
    this.activeSideKey = sideKey;
    this.draftHtml = "";
    this.lifecyclePending = null;
    this.lifecycleError = null;
    this.focusRequest = null;
    this.scrollRequest = null;
  }

  startNew(params: StartNewParams): MutationEnvelope {
    this.activateSession(params.sessionKey, null);
    this.localPresentation = {
      sessionKey: params.sessionKey,
      recipientLabel: params.recipientLabel,
      subject: params.subject,
    };

    const clientMessageId = nextMessageId();
    const envelope = deepFreeze<MutationEnvelope>({
      kind: "create",
      clientMessageId,
      tenantId: params.tenantId,
      parentKey: params.parentKey,
      request: params.request,
      sessionKey: params.sessionKey,
      startedAt: Date.now(),
    });

    this.envelopes.set(clientMessageId, envelope);
    this.overlayRecords = [
      ...this.overlayRecords.filter(
        ({ envelope: retained }) => retained.sessionKey !== params.sessionKey
      ),
      {
        envelope,
        message: {
          id: clientMessageId,
          direction: "own",
          body: sanitizeHtml(params.body),
          status: "pending",
          createdAt: envelope.startedAt,
          senderEmail: envelopeCreator(envelope) ?? undefined,
          internal: false,
        },
        sideKey: null,
        accepted: false,
      },
    ];
    return envelope;
  }

  setDraftHtml(html: string): void {
    this.draftHtml = html;
  }

  sendReply(params: ReplyParams): MutationEnvelope | null {
    if (
      params.solved ||
      this.activeSessionKey !== params.sessionKey ||
      this.activeSideKey !== params.sideKey ||
      !this.draftHtml.trim()
    ) {
      return null;
    }

    const body = buildQuotedReplyHtml(
      this.draftHtml,
      params.canonicalMessages
        .filter((message) => message.status === "sent" && !message.internal)
        .map((message) => ({
          html: message.body,
          publicVisible: true,
        }))
    );
    if (!body.trim()) return null;

    const request: ReplyTicketPatchRequest = {
      comment: {
        body,
        publicVisible: true,
        creator: [{ key: "us.email", value: params.agentEmail }],
      },
    };
    const clientMessageId = nextMessageId();
    const envelope = deepFreeze<MutationEnvelope>({
      kind: "reply",
      clientMessageId,
      tenantId: params.tenantId,
      parentKey: params.parentKey,
      sideKey: params.sideKey,
      request,
      sessionKey: params.sessionKey,
      startedAt: Date.now(),
    });

    this.draftHtml = "";
    this.envelopes.set(clientMessageId, envelope);
    this.overlayRecords = [
      ...this.overlayRecords,
      {
        envelope,
        message: {
          id: clientMessageId,
          direction: "own",
          body,
          status: "pending",
          createdAt: envelope.startedAt,
          senderEmail: params.agentEmail,
          internal: false,
        },
        sideKey: params.sideKey,
        accepted: false,
      },
    ];
    return envelope;
  }

  setSolved(params: LifecycleParams): MutationEnvelope | null {
    return params.solved ? null : this.createLifecycleEnvelope("solve", params);
  }

  reopen(params: LifecycleParams): MutationEnvelope | null {
    return params.solved
      ? this.createLifecycleEnvelope("reopen", params)
      : null;
  }

  retryLifecycle(): MutationEnvelope | null {
    if (!this.lifecycleError) return null;
    return this.getRetryEnvelope(this.lifecycleError.clientMessageId);
  }

  mutationStarted(envelope: MutationEnvelope): void {
    if (!this.isCurrent(envelope) || !this.isRetained(envelope)) return;

    if (hasMessage(envelope)) {
      this.overlayRecords = this.overlayRecords.map((record) =>
        record.envelope === envelope
          ? {
              ...record,
              accepted: false,
              message: {
                ...record.message,
                status: "pending",
                errorKind: undefined,
              },
            }
          : record
      );
      return;
    }

    this.lifecyclePending = envelope.kind;
    this.lifecycleError = null;
  }

  mutationFailed(envelope: MutationEnvelope, kind: "network" | "server"): void {
    if (!this.isCurrent(envelope) || !this.isRetained(envelope)) return;

    if (hasMessage(envelope)) {
      this.overlayRecords = this.overlayRecords.map((record) =>
        record.envelope === envelope
          ? {
              ...record,
              accepted: false,
              message: {
                ...record.message,
                status: "failed",
                errorKind: kind,
              },
            }
          : record
      );
      return;
    }

    this.lifecyclePending = null;
    this.lifecycleError = {
      action: envelope.kind,
      errorKind: kind,
      clientMessageId: envelope.clientMessageId,
    };
  }

  bindCreatedTicket(envelope: MutationEnvelope, sideKey: string): void {
    if (
      envelope.kind !== "create" ||
      !sideKey ||
      !this.isCurrent(envelope) ||
      !this.isRetained(envelope)
    ) {
      return;
    }

    this.activeSideKey = sideKey;
    this.overlayRecords = this.overlayRecords.map((record) =>
      record.envelope === envelope ? { ...record, sideKey } : record
    );
  }

  mutationAccepted(envelope: MutationEnvelope): void {
    if (!this.isCurrent(envelope) || !this.isRetained(envelope)) return;

    if (hasMessage(envelope)) {
      this.overlayRecords = this.overlayRecords.map((record) =>
        record.envelope === envelope
          ? {
              ...record,
              accepted: true,
              message: {
                ...record.message,
                status: "sent",
                errorKind: undefined,
              },
            }
          : record
      );
      return;
    }

    this.lifecyclePending = null;
    this.lifecycleError = null;
  }

  reconcileCanonical(
    sessionKey: number,
    sideKey: string,
    messages: MessageVM[]
  ): void {
    if (
      this.activeSessionKey !== sessionKey ||
      this.activeSideKey !== sideKey
    ) {
      return;
    }

    const scope = `${sessionKey}:${sideKey}`;
    const usedIds = this.matchedCanonicalIds.get(scope) ?? new Set<string>();
    const canonical = [...messages]
      .filter(
        (message) =>
          message.id.startsWith("comment-") &&
          message.direction === "own" &&
          !message.internal &&
          !usedIds.has(message.id)
      )
      .sort(
        (left, right) =>
          left.createdAt - right.createdAt || left.id.localeCompare(right.id)
      );
    const matchedOverlays = new Set<string>();

    this.overlayRecords
      .filter(
        (record) =>
          record.accepted &&
          record.envelope.sessionKey === sessionKey &&
          record.sideKey === sideKey &&
          hasMessage(record.envelope)
      )
      .sort(
        (left, right) =>
          left.envelope.startedAt - right.envelope.startedAt ||
          left.envelope.clientMessageId.localeCompare(
            right.envelope.clientMessageId
          )
      )
      .forEach((record) => {
        const expectedBody = envelopeBody(record.envelope);
        const expectedCreator = envelopeCreator(record.envelope);
        const match = canonical.find(
          (message) =>
            !usedIds.has(message.id) &&
            message.createdAt >= record.envelope.startedAt &&
            sanitizeHtml(message.body) === expectedBody &&
            message.senderEmail === expectedCreator
        );
        if (!match) return;

        usedIds.add(match.id);
        matchedOverlays.add(record.envelope.clientMessageId);
      });

    if (matchedOverlays.size === 0) return;
    this.matchedCanonicalIds.set(scope, usedIds);
    this.overlayRecords = this.overlayRecords.filter(
      (record) => !matchedOverlays.has(record.envelope.clientMessageId)
    );
  }

  getRetryEnvelope(clientMessageId: string): MutationEnvelope | null {
    return this.envelopes.get(clientMessageId) ?? null;
  }

  getOverlayMessages(sessionKey: number, sideKey: string | null): MessageVM[] {
    return this.overlayRecords
      .filter(
        (record) =>
          record.envelope.sessionKey === sessionKey &&
          record.sideKey === sideKey
      )
      .map((record) => record.message);
  }

  mergeCanonical(
    sessionKey: number,
    sideKey: string,
    canonicalMessages: readonly MessageVM[]
  ): MessageVM[] {
    const byId = new Map<string, MessageVM>();
    [...canonicalMessages, ...this.getOverlayMessages(sessionKey, sideKey)]
      .sort(
        (left, right) =>
          left.createdAt - right.createdAt || left.id.localeCompare(right.id)
      )
      .forEach((message) => byId.set(message.id, message));
    return Array.from(byId.values());
  }

  getLocalPresentation(sessionKey: number): LocalThreadPresentation | null {
    return this.localPresentation?.sessionKey === sessionKey
      ? this.localPresentation
      : null;
  }

  requestComposerFocus(sessionKey: number, sideKey: string | null): void {
    if (!this.matchesActive(sessionKey, sideKey)) return;
    this.focusRequest = { sessionKey, sideKey, value: true };
  }

  consumeComposerFocus(sessionKey: number, sideKey: string | null): boolean {
    if (
      !this.focusRequest ||
      this.focusRequest.sessionKey !== sessionKey ||
      this.focusRequest.sideKey !== sideKey
    ) {
      return false;
    }
    this.focusRequest = null;
    return true;
  }

  requestScroll(
    sessionKey: number,
    sideKey: string | null,
    messageId: string
  ): void {
    if (!this.matchesActive(sessionKey, sideKey)) return;
    this.scrollRequest = { sessionKey, sideKey, value: messageId };
  }

  consumeScrollRequest(
    sessionKey: number,
    sideKey: string | null
  ): string | null {
    if (
      !this.scrollRequest ||
      this.scrollRequest.sessionKey !== sessionKey ||
      this.scrollRequest.sideKey !== sideKey
    ) {
      return null;
    }
    const request = this.scrollRequest.value;
    this.scrollRequest = null;
    return request;
  }

  private createLifecycleEnvelope(
    kind: "solve" | "reopen",
    params: LifecycleParams
  ): MutationEnvelope | null {
    if (
      this.lifecyclePending ||
      !this.matchesActive(params.sessionKey, params.sideKey)
    ) {
      return null;
    }

    const request: StatusTicketPatchRequest = {
      fields: [
        {
          key: "ts.status",
          value: kind === "solve" ? "4" : "2",
        },
      ],
    };
    const envelope = deepFreeze<MutationEnvelope>({
      kind,
      clientMessageId: nextMessageId(),
      tenantId: params.tenantId,
      parentKey: params.parentKey,
      sideKey: params.sideKey,
      request,
      sessionKey: params.sessionKey,
      startedAt: Date.now(),
    });
    this.envelopes.set(envelope.clientMessageId, envelope);
    this.mutationStarted(envelope);
    return envelope;
  }

  private isCurrent(envelope: MutationEnvelope): boolean {
    if (this.activeSessionKey !== envelope.sessionKey) return false;
    return (
      envelope.kind === "create" || this.activeSideKey === envelope.sideKey
    );
  }

  private matchesActive(sessionKey: number, sideKey: string | null): boolean {
    return (
      this.activeSessionKey === sessionKey && this.activeSideKey === sideKey
    );
  }

  private isRetained(envelope: MutationEnvelope): boolean {
    return this.envelopes.get(envelope.clientMessageId) === envelope;
  }
}
