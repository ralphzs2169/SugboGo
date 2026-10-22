import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import BusinessProfileErrorState from "../components/business-profile/state/BusinessProfileErrorState";
import BusinessProfileSkeletonContent from "../components/business-profile/state/BusinessProfileSkeletonContent";
import ReadOnlyBusinessProfile from "../components/business-profile/ReadOnlyBusinessProfile";
import useBusinessDetailSource from "../hooks/useBusinessDetailSource";
import LiveBusinessProfile, {
  type BusinessProfileProps,
} from "./LiveBusinessProfile";

/** Selects one profile subtree so local presentation never initializes live-only effects. */
export default function ExploreBusinessProfileScreen(
  props: BusinessProfileProps,
) {
  const detail = useBusinessDetailSource(props.businessId);
  if (detail.source === "live" && detail.business) {
    return (
      <LiveBusinessProfile
        {...props}
        business={detail.business}
        error={detail.error}
        refetch={detail.refetch}
      />
    );
  }
  if (
    detail.snapshot &&
    (detail.source === "offline-pocket" || detail.source === "recent")
  ) {
    return (
      <ReadOnlyBusinessProfile
        snapshot={detail.snapshot}
        source={detail.source}
        localCoverUri={detail.localCoverUri}
        refreshing={detail.isFetching}
        onRefresh={() => void detail.refetch()}
      />
    );
  }
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1 bg-background"
    >
      {detail.isLoading ? (
        <BusinessProfileSkeletonContent />
      ) : (
        <BusinessProfileErrorState
          onRetry={() => void detail.refetch()}
          onGoBack={() => router.back()}
        />
      )}
    </SafeAreaView>
  );
}
