import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
    },
    mutations: {
      // Let the API reject offline actions immediately instead of pausing them.
      networkMode: "always",
    },
  },
});
