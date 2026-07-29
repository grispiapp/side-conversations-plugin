export const sideConversationKeys = {
  list: (tenantId: string | null, parentKey: string | null) =>
    ["side-conversations", tenantId, parentKey] as const,
  detail: (tenantId: string | null, sideKey: string | null) =>
    ["side-conversation", tenantId, sideKey] as const,
  customers: (tenantId: string | null, term: string) =>
    ["customers", tenantId, term.trim().toLowerCase()] as const,
};
