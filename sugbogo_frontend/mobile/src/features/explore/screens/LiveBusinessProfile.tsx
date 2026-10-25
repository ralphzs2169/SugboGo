import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { onlineManager } from "@tanstack/react-query";
import { router } from "expo-router";
import { useLayoutEffect, useRef, useState } from "react";
import { View } from "react-native";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { getAuthSessionGeneration } from "@/shared/api/authSessionGeneration.service";
import { formatDistance } from "@/shared/utils/distance.utils";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";
import BusinessProfileQuickInfo from "../components/business-profile/BusinessProfileQuickInfo";
import BusinessProfileSection from "../components/business-profile/BusinessProfileSection";
import BusinessReviewsSection from "../components/business-profile/reviews/review-preview-section/BusinessReviewsPreviewSection";
import ReviewComposerSheet from "../components/business-profile/ReviewComposerSheet";
import RideProviderSheet from "../components/business-profile/RideProviderSheet";
import SimilarPlacesSection from "../components/business-profile/SimilarPlacesSection";
import TransportAction from "../components/business-profile/TransportAction";
import MapRouteOptionIcon from "../assets/getting-there-icons/route-map-option.svg";
import JeepneyOptionIcon from "../assets/getting-there-icons/jeep-route-option.svg";
import BookRideOptionIcon from "../assets/getting-there-icons/book-ride-option.svg";
import useBusinessProfileVisit from "../hooks/useBusinessProfileVisit";
import type { DiscoverySource } from "../constants/discoverySources";
import { useBusinessReviewPreview } from "../hooks/useBusinessReviews";
import type { ExploreBusinessDetail } from "../types/exploreBusiness.types";
import useRoutePlanningIntent from "../hooks/useRoutePlanningIntent";
import { ReviewDerivedDataSyncProvider } from "../hooks/ReviewDerivedDataSyncProvider";
import type { BusinessReview } from "../types/review.types";
import { getQuickInfoStatus } from "../utils/businessHours.utils";
import useBusinessHours from "../hooks/useBusinessHours";

export type BusinessProfileProps = {
  businessId: number;
  distance: number | null;
  distanceAccuracy: number | null;
  previewAsExplorer?: boolean;
  profileSource?: DiscoverySource;
};

type LiveProps = BusinessProfileProps & { business: ExploreBusinessDetail };

/** Rejects callbacks retained by a live subtree after it has lost authority. */
function useLiveActionAuthority() {
  const mounted = useRef(true);
  const [identity] = useState(() => ({
    ownerId: useAuthStore.getState().user?.id,
    generation: getAuthSessionGeneration(),
  }));
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return () => {
    const auth = useAuthStore.getState();
    return (
      mounted.current &&
      onlineManager.isOnline() &&
      auth.isAuthenticated &&
      !auth.isLoading &&
      auth.user?.id === identity.ownerId &&
      getAuthSessionGeneration() === identity.generation
    );
  };
}

/** Supplies current quick-info values only while the live branch is mounted. */
export function LiveBusinessQuickInfo({
  business,
  distance,
  distanceAccuracy,
}: LiveProps) {
  const { totalCount } = useBusinessReviewPreview(business.id);
  const hours = useBusinessHours(business.operating_hours);
  const status = getQuickInfoStatus(hours);
  return (
    <BusinessProfileQuickInfo
      reviewCount={totalCount ?? business.review_count}
      overallVibe={business.overall_vibe}
      statusLabel={status.statusLabel}
      statusDetail={status.statusDetail}
      isOpenNow={status.isOpen}
      distance={
        distance !== null ? formatDistance(distance, distanceAccuracy) : null
      }
    />
  );
}

/** Owns route intent and ride workflows; fallback uses pure disabled transport controls. */
export function LiveBusinessVisitActions({
  business,
  previewAsExplorer = false,
}: LiveProps) {
  const canAct = useLiveActionAuthority();
  const recordRouteIntent = useRoutePlanningIntent(
    business.id,
    business.is_own_business,
  );
  const rideRef = useRef<BottomSheetModal | null>(null);
  if (business.is_own_business && !previewAsExplorer) return null;

  function openRoute(method: "ROAD_ROUTE" | "JEEPNEY") {
    if (!canAct()) return;
    recordRouteIntent(method);
    router.push({
      pathname:
        method === "ROAD_ROUTE"
          ? "/(explorer)/business/[businessId]/road-route"
          : "/(explorer)/business/[businessId]/jeepney-guide",
      params: { businessId: String(business.id) },
    });
  }
  return (
    <>
      <View className="flex-row gap-2 rounded-lg">
        <TransportAction
          SvgIcon={MapRouteOptionIcon}
          label="Road Route"
          accessibilityLabel="View road route"
          onPress={() => openRoute("ROAD_ROUTE")}
        />
        <TransportAction
          SvgIcon={JeepneyOptionIcon}
          label="Jeepney"
          accessibilityLabel="Open jeepney guide"
          onPress={() => openRoute("JEEPNEY")}
        />
        <TransportAction
          SvgIcon={BookRideOptionIcon}
          label="Book a ride"
          accessibilityLabel="Choose a ride provider"
          onPress={() => {
            if (canAct()) presentBottomSheet(rideRef);
          }}
        />
      </View>
      <RideProviderSheet sheetRef={rideRef} />
    </>
  );
}

function LiveReviews({
  business,
  businessId,
  previewAsExplorer = false,
  profileSource = "UNKNOWN",
}: LiveProps) {
  const canAct = useLiveActionAuthority();
  useBusinessProfileVisit(
    businessId,
    business.id,
    business.is_own_business,
    profileSource,
  );
  const composerRef = useRef<BottomSheetModal | null>(null);
  const [editingReview, setEditingReview] = useState<BusinessReview | null>(
    null,
  );
  return (
    <>
      <BusinessProfileSection>
        <BusinessReviewsSection
          businessId={business.id}
          businessName={business.business_name}
          isOwnBusiness={business.is_own_business}
          displayAsExplorer={previewAsExplorer}
          hasOwnReview={business.has_own_review}
          reviewCount={business.review_count}
          reviewInsights={business.review_insights}
          regeneration={business.review_insight_regeneration}
          onWriteReview={() => {
            if (!canAct()) return;
            setEditingReview(null);
            presentBottomSheet(composerRef);
          }}
          onEditReview={(review) => {
            if (!canAct()) return;
            setEditingReview(review);
            presentBottomSheet(composerRef);
          }}
        />
      </BusinessProfileSection>
      <SimilarPlacesSection businessId={business.id} />
      <ReviewComposerSheet
        businessId={business.id}
        businessName={business.business_name}
        coverPhotoUrl={business.display_cover_photo_url}
        sheetRef={composerRef}
        review={editingReview}
      />
    </>
  );
}

/** Mounts reviews, synchronization, tracking and similar places only for authoritative live detail. */
export default function LiveBusinessProfile(props: LiveProps) {
  return (
    <ReviewDerivedDataSyncProvider businessId={props.businessId}>
      <LiveReviews {...props} />
    </ReviewDerivedDataSyncProvider>
  );
}
