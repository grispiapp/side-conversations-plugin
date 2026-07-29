import { QueryClient } from "@tanstack/react-query";

const sharedQueryDefaults = {
  refetchInterval: false as const,
  refetchOnReconnect: true as const,
  refetchOnWindowFocus: false as const,
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      ...sharedQueryDefaults,
      retry: 1,
    },
    mutations: {
      retry: false,
    },
  },
});

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        ...sharedQueryDefaults,
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
