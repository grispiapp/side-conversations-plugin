import { QueryClient } from "@tanstack/react-query";

import { createTestQueryClient, queryClient } from "@/query/query-client";
import { sideConversationKeys } from "@/query/query-keys";

describe("sideConversationKeys", () => {
  it("creates only the exact tenant-scoped tuple shapes", () => {
    expect(sideConversationKeys.list("tenant-1", "TICKET-1")).toEqual([
      "side-conversations",
      "tenant-1",
      "TICKET-1",
    ]);
    expect(sideConversationKeys.detail("tenant-1", "SIDE-1")).toEqual([
      "side-conversation",
      "tenant-1",
      "SIDE-1",
    ]);
    expect(
      sideConversationKeys.customers("tenant-1", "  Alice@EXAMPLE.COM ")
    ).toEqual(["customers", "tenant-1", "alice@example.com"]);
  });

  it("separates identical resource values for different tenants", () => {
    const client = createTestQueryClient();
    const tenantOneKey = sideConversationKeys.list("tenant-1", "TICKET-1");
    const tenantTwoKey = sideConversationKeys.list("tenant-2", "TICKET-1");

    expect(tenantOneKey).not.toEqual(tenantTwoKey);

    client.setQueryData(tenantOneKey, ["tenant-one-data"]);

    expect(client.getQueryData(tenantOneKey)).toEqual(["tenant-one-data"]);
    expect(client.getQueryData(tenantTwoKey)).toBeUndefined();
  });
});

describe("query clients", () => {
  afterEach(() => {
    queryClient.clear();
  });

  it("exports one module-stable production client with bounded ambient policy", () => {
    const repeatedImport = require("@/query/query-client") as {
      queryClient: QueryClient;
    };

    expect(queryClient).toBeInstanceOf(QueryClient);
    expect(repeatedImport.queryClient).toBe(queryClient);
    expect(queryClient.getDefaultOptions().queries).toEqual(
      expect.objectContaining({
        refetchInterval: false,
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
        retry: 1,
      })
    );
  });

  it("creates isolated clients with query and mutation retries disabled", () => {
    const first = createTestQueryClient();
    const second = createTestQueryClient();
    const key = sideConversationKeys.detail("tenant-1", "SIDE-1");

    expect(first).not.toBe(second);
    expect(first.getDefaultOptions().queries?.retry).toBe(false);
    expect(first.getDefaultOptions().mutations?.retry).toBe(false);

    first.setQueryData(key, { key: "SIDE-1" });
    expect(second.getQueryData(key)).toBeUndefined();
  });
});
