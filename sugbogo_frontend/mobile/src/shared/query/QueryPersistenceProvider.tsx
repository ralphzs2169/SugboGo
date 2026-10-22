import { useEffect, useSyncExternalStore, type PropsWithChildren } from "react";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import type { QueryClient } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  getAuthSessionGeneration,
  subscribeAuthSessionChanges,
} from "@/shared/api/authSessionGeneration.service";

import { queryClient } from "./queryClient";
import { queryPersistence } from "./queryPersistence.service";
import { getQueryPersistenceApiScope } from "./queryPersistencePolicies";

function subscribeGeneration(notify: () => void) {
  return subscribeAuthSessionChanges(() => notify());
}

/** Gates query fetching during scoped restoration, without granting local authentication. */
export default function QueryPersistenceProvider({
  children,
  client = queryClient,
  persistence = queryPersistence,
}: PropsWithChildren<{
  client?: QueryClient;
  persistence?: typeof queryPersistence;
}>) {
  const userId = useAuthStore((state) => state.user?.id);
  useAuthStore((state) => state.isAuthenticated);
  useAuthStore((state) => state.isLoading);
  const generation = useSyncExternalStore(
    subscribeGeneration,
    getAuthSessionGeneration,
    getAuthSessionGeneration,
  );
  const apiScope = getQueryPersistenceApiScope();
  // The coordinator reuses the handle while owner, API and generation match.
  const session = persistence.openSession(client);

  useEffect(() => session.track(), [session]);

  return (
    <PersistQueryClientProvider
      key={`${generation}:${userId ?? "anonymous"}:${apiScope}`}
      client={client}
      persistOptions={session.persistOptions}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
