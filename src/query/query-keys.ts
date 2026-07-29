export const sideConversationKeys = {
  list: (tenantId: string, parentKey: string) =>
    ["side-conversations", tenantId, parentKey] as const,
  detail: (tenantId: string, sideKey: string) =>
    ["side-conversation", tenantId, sideKey] as const,
  customers: (tenantId: string, term: string) =>
    ["customers", tenantId, term.trim().toLowerCase()] as const,
};
