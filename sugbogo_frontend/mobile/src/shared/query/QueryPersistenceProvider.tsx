import {
  useEffect,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from "react";
// Register temporary-detail cleanup before startup authentication runs.
import "@/features/explore/services/recentBusinessDetails.service";
import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from "@tanstack/react-query-persist-client";
import {
  IsRestoringProvider,
  QueryClientProvider,
  type QueryClient,
} from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  getAuthSessionGeneration,
  subscribeAuthSessionChanges,
} from "@/shared/api/authSessionGeneration.service";

import { queryClient } from "./queryClient";
import { queryPersistence } from "./queryPersistence.service";

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
  useAuthStore((state) => state.user?.id);
  useAuthStore((state) => state.isAuthenticated);
  useAuthStore((state) => state.isLoading);
  useSyncExternalStore(
    subscribeGeneration,
    getAuthSessionGeneration,
    getAuthSessionGeneration,
  );
  // The coordinator reuses the handle while owner, API and generation match.
  const session = persistence.openSession(client);

  const [restoredSession, setRestoredSession] = useState<typeof session | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const stopTracking = session.track();
    const options = { queryClient: client, ...session.persistOptions };

    // Restore each scope without remounting navigation or resetting open forms.
    void persistQueryClientRestore(options)
      .catch(() => undefined)
      .finally(() => {
        if (cancelled) return;
        unsubscribe = persistQueryClientSubscribe(options);
        setRestoredSession(session);
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
      stopTracking();
    };
  }, [client, session]);

  return (
    <QueryClientProvider client={client}>
      <IsRestoringProvider value={restoredSession !== session}>
        {children}
      </IsRestoringProvider>
    </QueryClientProvider>
  );
}
