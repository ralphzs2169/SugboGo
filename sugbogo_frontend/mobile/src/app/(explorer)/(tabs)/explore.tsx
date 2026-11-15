import { useAuthStore } from "@/features/auth/store/auth.store";
import useOfflineExploreCache from "@/features/explore/hooks/useOfflineExploreCache";
import ExploreScreen from "@/features/explore/screens/ExploreScreen";
import {
  isRecentExploreCurrent,
  useOfflineAccessStore,
} from "@/features/offline-routes/stores/offlineAccess.store";

/** Keeps the same Explore screen mounted while the current account reconnects. */
export default function Explore() {
  const user = useAuthStore((state) => state.isAuthenticated ? state.user : null);
  const grant = useOfflineAccessStore((state) => state.recentExplore);
  const hasDownloads = useOfflineAccessStore((state) => state.ownerId !== null);
  const isRevoking = useOfflineAccessStore((state) => state.isRevoking);
  const cached = grant && !isRevoking && isRecentExploreCurrent(grant) ? grant : null;
  useOfflineExploreCache(cached);

  if (!user && !cached) return null;

  return (
    <ExploreScreen
      key={user?.id ?? cached?.ownerId}
      offline={!!cached}
      hasDownloads={hasDownloads}
    />
  );
}
