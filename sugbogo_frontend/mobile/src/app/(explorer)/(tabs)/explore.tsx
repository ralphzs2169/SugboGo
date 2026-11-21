import { useAuthStore } from "@/features/auth/store/auth.store";
import useOfflineExploreCache from "@/features/explore/hooks/useOfflineExploreCache";
import ExploreScreen from "@/features/explore/screens/ExploreScreen";
import {
  isRecentExploreCurrent,
  useOfflineAccessStore,
} from "@/features/offline-routes/stores/offlineAccess.store";

/** Opens read-only Explore while the saved session waits for validation. */
export default function Explore() {
  const user = useAuthStore((state) => state.isAuthenticated ? state.user : null);
  const grant = useOfflineAccessStore((state) => state.recentExplore);
  const hasDownloads = useOfflineAccessStore((state) => state.ownerId !== null);
  const sessionSuspended = useOfflineAccessStore((state) => state.sessionSuspended);
  const cached = grant && isRecentExploreCurrent(grant) ? grant : null;
  const offline = !user && (sessionSuspended || !!cached);
  useOfflineExploreCache(cached);

  if (!user && !offline) return null;

  return (
    <ExploreScreen
      key={user?.id ?? cached?.ownerId}
      offline={offline}
      offlineWithoutCache={offline && !cached}
      hasDownloads={hasDownloads}
    />
  );
}
