import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { View } from "react-native";
import { useEffect, useState } from "react";
import useOfflineBusinessSnapshots from "@/features/offline-pockets/hooks/useOfflineBusinessSnapshots";
import { OFFLINE_BUSINESS_SNAPSHOT_VERSION } from "@/features/offline-pockets/constants/offlinePockets.constants";
import ErrorState from "@/shared/components/ErrorState";
import Skeleton from "@/shared/components/Skeleton";
import ReadOnlyBusinessProfile from "../components/business-profile/ReadOnlyBusinessProfile";
import RecentExploreHeader from "../components/RecentExploreHeader";
import useRecentExplore from "../hooks/useRecentExplore";
import { isRecentExploreCurrent } from "../services/recentExplore.service";
import {
  recentBusinessDetails,
  RECENT_BUSINESS_LIMITS,
} from "../services/recentBusinessDetails.service";

/** Local detail only: deliberately never imports the live profile or its source hook. */
export default function RecentExploreBusinessScreen({
  businessId,
}: {
  businessId: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  const recent = useRecentExplore();
  const grant = recent.grant;
  const allowed = grant !== null && recent.feeds.length > 0;
  const pocket = useOfflineBusinessSnapshots(businessId, allowed);
  const detail = useQuery({
    queryKey: [
      "local-recent-business",
      grant?.apiScope,
      grant?.ownerId,
      grant?.generation,
      businessId,
    ],
    enabled: allowed,
    networkMode: "always",
    retry: false,
    gcTime: 0,
    staleTime: 0,
    queryFn: () =>
      grant
        ? recentBusinessDetails.readLocal(businessId, {
            ...grant,
            current: () => isRecentExploreCurrent(grant),
          })
        : Promise.resolve(null),
  });
  const { data: recentDetail, refetch: refetchDetail } = detail;
  useEffect(() => {
    if (!recentDetail) return;
    const expiry =
      Date.parse(recentDetail.fetchedAt) + RECENT_BUSINESS_LIMITS.maxAgeMs;
    const timer = setTimeout(
      () => {
        setNow(Date.now());
        void refetchDetail();
      },
      Math.max(1, expiry - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [recentDetail, refetchDetail]);
  const entry = pocket.data?.entries[0];
  const durable =
    allowed &&
    pocket.ownerId === grant?.ownerId &&
    pocket.data?.context.sessionGeneration === grant?.generation &&
    pocket.data?.context.apiScope === grant?.apiScope &&
    entry?.status === "available" &&
    entry.snapshot.business.id === businessId
      ? entry.snapshot
      : null;
  const temporary =
    allowed &&
    detail.data &&
    now - Date.parse(detail.data.fetchedAt) < RECENT_BUSINESS_LIMITS.maxAgeMs
      ? detail.data
      : null;
  const snapshot =
    durable ??
    (temporary
      ? {
          formatVersion: OFFLINE_BUSINESS_SNAPSHOT_VERSION,
          fetchedAt: temporary.fetchedAt,
          business: temporary.business,
        }
      : null);
  if (snapshot)
    return (
      <ReadOnlyBusinessProfile
        snapshot={snapshot}
        source={durable ? "offline-pocket" : "recent"}
        localCoverUri={durable ? pocket.data?.covers?.[businessId] : undefined}
        refreshing={false}
        onGoBack={() => router.replace("/recent-explore")}
        onRefresh={() => {
          void detail.refetch();
          if (pocket.ownerId) void pocket.refetch();
        }}
      />
    );
  return (
    <SafeAreaView className="flex-1 bg-background">
      <RecentExploreHeader />
      {(allowed && (detail.isPending || pocket.isFetching)) ||
      (recent.grant && recent.isPending) ? (
        <View className="px-screen-x">
          <Skeleton className="h-60 rounded-card" />
        </View>
      ) : (
        <ErrorState
          size="small"
          icon="store-off-outline"
          title="Business unavailable offline"
          description="This place doesn't have readable saved or previously loaded information on this device."
          primaryActionTitle="Back to Recent Explore"
          onPrimaryAction={() => router.replace("/recent-explore")}
        />
      )}
    </SafeAreaView>
  );
}
