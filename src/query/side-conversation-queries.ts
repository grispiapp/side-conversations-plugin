import { sideConversationKeys } from "./query-keys";
import {
  QueryClient,
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { grispiAPI } from "@/grispi/client/api";
import { NetworkError } from "@/grispi/client/http-handler";
import {
  ConversationLifecycleStatus,
  parseConversationLifecycleStatus,
} from "@/lib/conversation-status";
import {
  QuotedContextPart,
  sanitizeHtml,
  splitGeneratedReplyHtml,
  splitQuotedHtml,
} from "@/lib/html-sanitizer";
import { getLastSeenAt, setLastSeenAt } from "@/lib/last-seen-store";
import {
  SIDE_CONVERSATION_PARENT_FIELD_KEY,
  isValidEmail,
} from "@/lib/side-conversation";
import {
  ActiveConversationStore,
  MessageVM,
  MutationEnvelope,
} from "@/store/active-conversation-store";
import {
  ConversationRowVM,
  RECIPIENT_UNKNOWN_PLACEHOLDER,
  dedupeAndSortConversationRows,
  projectConversationRow,
} from "@/store/side-conversations-store";
import {
  AdvancedSearchResponse,
  Comment,
  Customer,
  SideTicketSummary,
  Ticket,
} from "@/types/grispi.type";

const SIDE_CONVERSATION_PAGE_SIZE = 5;
const CUSTOMER_PAGE_SIZE = 10;
const LIST_STALE_TIME = 30_000;
const DETAIL_STALE_TIME = 15_000;
const CUSTOMER_STALE_TIME = 30_000;
const MIN_CUSTOMER_TERM_LENGTH = 3;
const CUSTOMER_DEBOUNCE_MS = 300;

const finiteReadPolicy = {
  refetchInterval: false as const,
  refetchOnReconnect: true as const,
  refetchOnWindowFocus: false as const,
};

export interface SideConversationListPage {
  rows: ConversationRowVM[];
  pageNumber: number;
  totalPages: number;
  totalSize: number;
  numberOfElements: number;
}

export interface CustomerQueryVM {
  id: number;
  name: string | null;
  email: string | null;
}

export interface SideConversationDetail {
  sideKey: string;
  recipientLabel: string;
  subject: string;
  lifecycle: ConversationLifecycleStatus;
  solved: boolean;
  reopenable: boolean;
  messages: MessageVM[];
  latestRelevantExternalAt: number | null;
}

export interface SelectedMutationSession {
  ticketKey: string | null;
  parentKey: string;
  sessionKey: number;
}

export interface MutationBoundary {
  activeConversation: ActiveConversationStore;
  getSelectedConversation: () => SelectedMutationSession | null;
  bindCreatedTicket: (sessionKey: number, sideKey: string) => void;
}

function requireIdentity(value: string | null, identityName: string): string {
  if (!value) {
    throw new Error(`${identityName} is required before querying`);
  }
  return value;
}

async function hydrateSummaries(
  tenantId: string,
  summaries: SideTicketSummary[]
): Promise<ConversationRowVM[]> {
  const hydration = await Promise.allSettled(
    summaries.map((summary) => grispiAPI.tickets.getTicket(summary.key))
  );
  let rows = hydration.map((outcome, index) =>
    projectConversationRow(
      tenantId,
      summaries[index],
      outcome.status === "fulfilled" ? outcome.value : null
    )
  );

  const failedIndexes = hydration.flatMap((outcome, index) =>
    outcome.status === "rejected" ? [index] : []
  );
  if (failedIndexes.length > 0) {
    const repairs = await Promise.allSettled(
      failedIndexes.map((index) =>
        grispiAPI.tickets.getTicket(summaries[index].key)
      )
    );
    const repairedRows = [...rows];
    repairs.forEach((outcome, repairIndex) => {
      if (outcome.status !== "fulfilled") return;
      const rowIndex = failedIndexes[repairIndex];
      repairedRows[rowIndex] = projectConversationRow(
        tenantId,
        summaries[rowIndex],
        outcome.value
      );
    });
    rows = repairedRows;
  }

  const unresolvedIds = Array.from(
    new Set(
      rows.flatMap((row) =>
        row.recipientEmail === RECIPIENT_UNKNOWN_PLACEHOLDER &&
        row.requesterId !== null
          ? [row.requesterId]
          : []
      )
    )
  );
  if (unresolvedIds.length === 0) return rows;

  const users = await Promise.all(
    unresolvedIds.map(async (userId) => {
      try {
        const user = await grispiAPI.users.getUser(userId);
        return [userId, user?.primaryEmail ?? null] as const;
      } catch {
        return [userId, null] as const;
      }
    })
  );
  const emailByUserId = new Map(users);

  return rows.map((row) => {
    const email =
      row.requesterId === null ? null : emailByUserId.get(row.requesterId);
    return email ? { ...row, recipientEmail: email } : row;
  });
}

async function fetchSideConversationPage(
  tenantId: string,
  parentKey: string,
  page: number
): Promise<SideConversationListPage> {
  const response: AdvancedSearchResponse =
    await grispiAPI.tickets.advancedSearch(
      {
        allConditions: [
          {
            fieldKey: SIDE_CONVERSATION_PARENT_FIELD_KEY,
            operator: "EQUAL",
            value: parentKey,
          },
        ],
        anyConditions: [],
      },
      { size: SIDE_CONVERSATION_PAGE_SIZE, page }
    );
  const rows = await hydrateSummaries(tenantId, response.content);

  return {
    rows,
    pageNumber: response.pageNumber,
    totalPages: response.totalPages,
    totalSize: response.totalSize,
    numberOfElements: response.numberOfElements,
  };
}

export function sideConversationListOptions(
  tenantId: string | null,
  parentKey: string | null
) {
  return infiniteQueryOptions({
    queryKey: sideConversationKeys.list(tenantId, parentKey),
    queryFn: ({ pageParam }) => {
      requireIdentity(tenantId, "tenantId");
      return fetchSideConversationPage(
        tenantId!,
        requireIdentity(parentKey, "parentKey"),
        pageParam
      );
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.pageNumber + 1 < lastPage.totalPages
        ? lastPage.pageNumber + 1
        : undefined,
    enabled: Boolean(tenantId && parentKey),
    staleTime: LIST_STALE_TIME,
    ...finiteReadPolicy,
  });
}

export function useSideConversationsQuery(
  tenantId: string | null,
  parentKey: string | null
) {
  const query = useInfiniteQuery(
    sideConversationListOptions(tenantId, parentKey)
  );
  const rows = useMemo(
    () =>
      dedupeAndSortConversationRows(
        tenantId ?? "",
        query.data?.pages.flatMap((page) => page.rows) ?? []
      ),
    [query.data, tenantId]
  );

  return { ...query, rows };
}

export function sideConversationDetailOptions(
  tenantId: string | null,
  sideKey: string | null
) {
  return queryOptions({
    queryKey: sideConversationKeys.detail(tenantId, sideKey),
    queryFn: () => {
      requireIdentity(tenantId, "tenantId");
      return grispiAPI.tickets
        .getTicket(requireIdentity(sideKey, "sideKey"))
        .then(normalizeSideConversationDetail);
    },
    enabled: Boolean(tenantId && sideKey),
    staleTime: DETAIL_STALE_TIME,
    ...finiteReadPolicy,
  });
}

export function useSideConversationDetailQuery(
  tenantId: string | null,
  sideKey: string | null,
  parentKey: string | null,
  sessionKey: number | null,
  activeConversation: ActiveConversationStore,
  getSelectedConversation: () => SelectedMutationSession | null
) {
  const queryClient = useQueryClient();
  const query = useQuery(sideConversationDetailOptions(tenantId, sideKey));

  useEffect(() => {
    if (
      !query.data ||
      !tenantId ||
      !sideKey ||
      !parentKey ||
      sessionKey === null
    ) {
      return;
    }
    const selected = getSelectedConversation();
    if (
      !selected ||
      selected.ticketKey !== sideKey ||
      selected.parentKey !== parentKey ||
      selected.sessionKey !== sessionKey
    ) {
      return;
    }

    const lastSeenAt = getLastSeenAt(tenantId, sideKey);
    const scrollTargetMessageId = resolveDetailScrollTarget(
      query.data.messages,
      lastSeenAt
    );
    if (
      query.data.latestRelevantExternalAt !== null &&
      (lastSeenAt === null || query.data.latestRelevantExternalAt > lastSeenAt)
    ) {
      setLastSeenAt(tenantId, sideKey, query.data.latestRelevantExternalAt);
    }

    activeConversation.reconcileCanonical(
      sessionKey,
      sideKey,
      query.data.messages
    );
    if (scrollTargetMessageId) {
      activeConversation.requestScroll(
        sessionKey,
        sideKey,
        scrollTargetMessageId
      );
    }
    void queryClient.invalidateQueries({
      queryKey: sideConversationKeys.list(tenantId, parentKey),
      exact: true,
      refetchType: "all",
    });
  }, [
    activeConversation,
    getSelectedConversation,
    parentKey,
    query.data,
    query.dataUpdatedAt,
    queryClient,
    sessionKey,
    sideKey,
    tenantId,
  ]);

  return query;
}

export function customerSearchOptions(tenantId: string | null, term: string) {
  const queryKey = sideConversationKeys.customers(tenantId, term);
  const normalizedTerm = queryKey[2];

  return queryOptions({
    queryKey,
    queryFn: () => {
      requireIdentity(tenantId, "tenantId");
      return grispiAPI.customers.search({
        searchTerm: normalizedTerm,
        size: CUSTOMER_PAGE_SIZE,
        page: 0,
      });
    },
    enabled:
      Boolean(tenantId) && normalizedTerm.length >= MIN_CUSTOMER_TERM_LENGTH,
    staleTime: CUSTOMER_STALE_TIME,
    ...finiteReadPolicy,
  });
}

export function useCustomersQuery(tenantId: string | null, term: string) {
  const normalizedTerm = sideConversationKeys.customers(tenantId, term)[2];
  const [debouncedTerm, setDebouncedTerm] = useState("");

  useEffect(() => {
    if (normalizedTerm.length < MIN_CUSTOMER_TERM_LENGTH) {
      setDebouncedTerm(normalizedTerm);
      return;
    }

    const handle = setTimeout(
      () => setDebouncedTerm(normalizedTerm),
      CUSTOMER_DEBOUNCE_MS
    );
    return () => clearTimeout(handle);
  }, [normalizedTerm]);

  const isDebouncing = normalizedTerm !== debouncedTerm;
  const query = useQuery(customerSearchOptions(tenantId, debouncedTerm));
  const customers = useMemo<CustomerQueryVM[]>(
    () =>
      isDebouncing
        ? []
        : (query.data?.content ?? []).map((customer: Customer) => {
            const email =
              [customer.email, ...(customer.emails ?? [])]
                .map((candidate) => candidate?.trim())
                .find(
                  (candidate): candidate is string =>
                    Boolean(candidate) && isValidEmail(candidate!)
                ) ?? null;
            return {
              id: customer.id,
              name: customer.fullName,
              email,
            };
          }),
    [isDebouncing, query.data]
  );

  return {
    ...query,
    customers,
    isDebouncing,
    normalizedTerm,
  };
}

function normalizeComment(
  comment: Comment,
  publicContext: readonly QuotedContextPart[]
): MessageVM {
  const sanitized = sanitizeHtml(comment.body ?? "");
  const direction =
    comment.creator?.role?.authority === "ROLE_END_USER" ? "incoming" : "own";
  const quoted =
    direction === "own" && comment.publicVisible
      ? splitGeneratedReplyHtml(sanitized, publicContext)
      : splitQuotedHtml(sanitized);

  return {
    id: `comment-${comment.id}`,
    direction,
    body: sanitized,
    authoredBodyHtml: quoted.bodyHtml,
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

export function resolveDetailScrollTarget(
  messages: readonly MessageVM[],
  lastSeenAt: number | null
): string | null {
  const firstUnseen = messages.find(
    (message) =>
      message.direction === "incoming" &&
      !message.internal &&
      (lastSeenAt === null || message.createdAt > lastSeenAt)
  );
  return firstUnseen?.id ?? messages[messages.length - 1]?.id ?? null;
}

export function normalizeSideConversationDetail(
  ticket: Ticket
): SideConversationDetail {
  const publicContext: QuotedContextPart[] = [];
  const messages = [...(ticket.comments ?? [])]
    .sort(
      (left, right) => left.createdAt - right.createdAt || left.id - right.id
    )
    .map((comment) => {
      const message = normalizeComment(comment, publicContext);
      if (comment.publicVisible) {
        publicContext.push({
          authoredBodyHtml: message.authoredBodyHtml ?? message.body,
          publicVisible: true,
        });
      }
      return message;
    });
  const externalPublic = messages.filter(
    (message) => message.direction === "incoming" && !message.internal
  );
  const latestRelevantExternalAt =
    externalPublic.length > 0
      ? Math.max(...externalPublic.map((message) => message.createdAt))
      : null;

  const subject = ticket.fieldMap?.["ts.subject"]?.value;
  const lifecycle = parseConversationLifecycleStatus(
    ticket.fieldMap?.["ts.status"]?.value
  );
  return {
    sideKey: ticket.key,
    recipientLabel: resolveRecipientLabel(ticket),
    subject: typeof subject === "string" ? subject : "",
    lifecycle,
    solved: lifecycle !== "open",
    reopenable: lifecycle === "solved",
    messages,
    latestRelevantExternalAt,
  };
}

function isCurrent(
  boundary: MutationBoundary,
  envelope: MutationEnvelope,
  sideKey?: string
): boolean {
  const selected = boundary.getSelectedConversation();
  if (
    !selected ||
    selected.sessionKey !== envelope.sessionKey ||
    selected.parentKey !== envelope.parentKey
  ) {
    return false;
  }

  const expectedSideKey =
    sideKey ?? (envelope.kind === "create" ? null : envelope.sideKey);
  return selected.ticketKey === expectedSideKey;
}

function errorKind(error: unknown): "network" | "server" {
  return error instanceof NetworkError ? "network" : "server";
}

async function refreshCanonicalAfterMutation(
  queryClient: QueryClient,
  boundary: MutationBoundary,
  envelope: MutationEnvelope,
  sideKey: string
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: sideConversationKeys.list(envelope.tenantId, envelope.parentKey),
    exact: true,
    refetchType: "all",
  });
  if (!isCurrent(boundary, envelope, sideKey)) return;

  const detailKey = sideConversationKeys.detail(envelope.tenantId, sideKey);
  await queryClient.refetchQueries(
    {
      queryKey: detailKey,
      exact: true,
      type: "all",
    },
    { throwOnError: true }
  );
  if (!isCurrent(boundary, envelope, sideKey)) return;

  let detail = queryClient.getQueryData<SideConversationDetail>(detailKey);
  if (!detail) {
    detail = await queryClient.fetchQuery({
      ...sideConversationDetailOptions(envelope.tenantId, sideKey),
      staleTime: 0,
    });
  }
  if (!isCurrent(boundary, envelope, sideKey)) return;

  boundary.activeConversation.reconcileCanonical(
    envelope.sessionKey,
    sideKey,
    detail.messages
  );
  if (envelope.kind === "reopen" && !detail.solved) {
    boundary.activeConversation.requestComposerFocus(
      envelope.sessionKey,
      sideKey
    );
  }
}

export async function executeCreateMutation(
  queryClient: QueryClient,
  boundary: MutationBoundary,
  envelope: Extract<MutationEnvelope, { kind: "create" }>
): Promise<void> {
  if (!isCurrent(boundary, envelope)) return;
  boundary.activeConversation.mutationStarted(envelope);

  let sideKey: string;
  try {
    const response = await grispiAPI.tickets.createTicket(envelope.request);
    sideKey = response.key;
  } catch (error) {
    boundary.activeConversation.mutationFailed(envelope, errorKind(error));
    throw error;
  }

  if (!isCurrent(boundary, envelope)) return;
  boundary.activeConversation.bindCreatedTicket(envelope, sideKey);
  boundary.bindCreatedTicket(envelope.sessionKey, sideKey);
  if (!isCurrent(boundary, envelope, sideKey)) return;
  boundary.activeConversation.mutationAccepted(envelope);
  try {
    await refreshCanonicalAfterMutation(
      queryClient,
      boundary,
      envelope,
      sideKey
    );
  } catch {
    // The transport is already committed. Canonical convergence can be
    // retried by the exact detail/list Query seams, but this envelope must
    // never return to a resendable failure state.
  }
}

export async function executeReplyMutation(
  queryClient: QueryClient,
  boundary: MutationBoundary,
  envelope: Extract<MutationEnvelope, { kind: "reply" }>
): Promise<void> {
  if (!isCurrent(boundary, envelope)) return;
  boundary.activeConversation.mutationStarted(envelope);

  try {
    await grispiAPI.tickets.patchTicket(envelope.sideKey, envelope.request);
  } catch (error) {
    boundary.activeConversation.mutationFailed(envelope, errorKind(error));
    throw error;
  }

  if (!isCurrent(boundary, envelope)) return;
  boundary.activeConversation.mutationAccepted(envelope);
  try {
    await refreshCanonicalAfterMutation(
      queryClient,
      boundary,
      envelope,
      envelope.sideKey
    );
  } catch {
    // A failed cache refresh is not a failed outbound email.
  }
}

export async function executeStatusMutation(
  queryClient: QueryClient,
  boundary: MutationBoundary,
  envelope: Extract<MutationEnvelope, { kind: "solve" | "reopen" }>
): Promise<void> {
  if (!isCurrent(boundary, envelope)) return;
  boundary.activeConversation.mutationStarted(envelope);

  try {
    await grispiAPI.tickets.patchTicket(envelope.sideKey, envelope.request);
  } catch (error) {
    boundary.activeConversation.mutationFailed(envelope, errorKind(error));
    throw error;
  }

  if (!isCurrent(boundary, envelope)) return;
  boundary.activeConversation.mutationAccepted(envelope);
  try {
    await refreshCanonicalAfterMutation(
      queryClient,
      boundary,
      envelope,
      envelope.sideKey
    );
  } catch {
    // Lifecycle transport succeeded; keep canonical state until an exact
    // detail refresh eventually converges instead of offering a re-PATCH.
  }
}

export function useCreateSideConversationMutation(boundary: MutationBoundary) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["side-conversation", "create"],
    mutationFn: (envelope: Extract<MutationEnvelope, { kind: "create" }>) =>
      executeCreateMutation(queryClient, boundary, envelope),
  });
}

export function useReplySideConversationMutation(boundary: MutationBoundary) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["side-conversation", "reply"],
    mutationFn: (envelope: Extract<MutationEnvelope, { kind: "reply" }>) =>
      executeReplyMutation(queryClient, boundary, envelope),
  });
}

export function useStatusSideConversationMutation(boundary: MutationBoundary) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["side-conversation", "status"],
    mutationFn: (
      envelope: Extract<MutationEnvelope, { kind: "solve" | "reopen" }>
    ) => executeStatusMutation(queryClient, boundary, envelope),
  });
}
