import { sideConversationKeys } from "./query-keys";
import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { grispiAPI } from "@/grispi/client/api";
import { SIDE_CONVERSATION_PARENT_FIELD_KEY } from "@/lib/side-conversation";
import {
  ConversationRowVM,
  RECIPIENT_UNKNOWN_PLACEHOLDER,
  dedupeAndSortConversationRows,
  projectConversationRow,
} from "@/store/side-conversations-store";
import {
  AdvancedSearchResponse,
  Customer,
  SideTicketSummary,
} from "@/types/grispi.type";

const PAGE_SIZE = 10;
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
  email: string;
}

function requireIdentity(value: string | null, identityName: string): string {
  if (!value) {
    throw new Error(`${identityName} is required before querying`);
  }
  return value;
}

async function hydrateSummaries(
  summaries: SideTicketSummary[]
): Promise<ConversationRowVM[]> {
  const hydration = await Promise.allSettled(
    summaries.map((summary) => grispiAPI.tickets.getTicket(summary.key))
  );
  let rows = hydration.map((outcome, index) =>
    projectConversationRow(
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
      { size: PAGE_SIZE, page }
    );
  const rows = await hydrateSummaries(response.content);

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
        query.data?.pages.flatMap((page) => page.rows) ?? []
      ),
    [query.data]
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
      return grispiAPI.tickets.getTicket(requireIdentity(sideKey, "sideKey"));
    },
    enabled: Boolean(tenantId && sideKey),
    staleTime: DETAIL_STALE_TIME,
    ...finiteReadPolicy,
  });
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
        size: PAGE_SIZE,
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
        : (query.data?.content ?? []).map((customer: Customer) => ({
            id: customer.id,
            name: customer.fullName,
            email: customer.email,
          })),
    [isDebouncing, query.data]
  );

  return {
    ...query,
    customers,
    isDebouncing,
    normalizedTerm,
  };
}
