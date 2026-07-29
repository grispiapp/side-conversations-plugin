import { sideConversationKeys } from "./query-keys";
import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { grispiAPI } from "@/grispi/client/api";
import { SIDE_CONVERSATION_PARENT_FIELD_KEY } from "@/lib/side-conversation";

const PAGE_SIZE = 10;
const LIST_STALE_TIME = 30_000;
const DETAIL_STALE_TIME = 15_000;
const CUSTOMER_STALE_TIME = 30_000;
const MIN_CUSTOMER_TERM_LENGTH = 3;

const finiteReadPolicy = {
  refetchInterval: false as const,
  refetchOnReconnect: true as const,
  refetchOnWindowFocus: false as const,
};

function requireIdentity(value: string | null, identityName: string): string {
  if (!value) {
    throw new Error(`${identityName} is required before querying`);
  }
  return value;
}

export function sideConversationListOptions(
  tenantId: string | null,
  parentKey: string | null
) {
  return infiniteQueryOptions({
    queryKey: sideConversationKeys.list(tenantId, parentKey),
    queryFn: ({ pageParam }) => {
      requireIdentity(tenantId, "tenantId");
      return grispiAPI.tickets.advancedSearch(
        {
          allConditions: [
            {
              fieldKey: SIDE_CONVERSATION_PARENT_FIELD_KEY,
              operator: "EQUAL",
              value: requireIdentity(parentKey, "parentKey"),
            },
          ],
          anyConditions: [],
        },
        { size: PAGE_SIZE, page: pageParam }
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
