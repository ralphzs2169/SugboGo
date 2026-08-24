import { ReactNode, useRef } from "react";
import { Animated, RefreshControl } from "react-native";

import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";

import BusinessProfileStickyHeader from "./BusinessProfileStickyHeader";
import type { ExploreBusiness } from "../../types/exploreBusiness.types";

type Props = {
  business: ExploreBusiness;
  isRefreshing: boolean;
  onRefresh: () => void;
  children: ReactNode;
};

// Calibrated against the hero's fixed h-80 (320px) height: the nav row sits
// near the top (top-4) and scrolls out almost immediately, while the
// identity block sits near the bottom (bottom-5) and scrolls out much
// later. If business_name ever wraps to 2 lines, IDENTITY_THRESHOLD may
// fire a little early/late for that business — switch to onLayout-measured
// offsets if that becomes noticeable.
const NAV_THRESHOLD = 40;
const IDENTITY_THRESHOLD = 260;

/**
 * BusinessProfileScrollView handles the scrolling behavior and the
 * two-stage sticky header reveal for the business profile screen.
 */
export default function BusinessProfileScrollView({
  business,
  isRefreshing,
  onRefresh,
  children,
}: Props) {
  const navOpacity = useRef(new Animated.Value(0)).current;
  const identityOpacity = useRef(new Animated.Value(0)).current;
  const stickyHeaderTranslateY = useRef(new Animated.Value(-20)).current;

  const wasPastNavThreshold = useRef(false);
  const wasPastIdentityThreshold = useRef(false);

  const clusterIconName = CLUSTER_ICONS[business.cluster.icon] ?? "store";

  function handleScroll(event: any) {
    const offsetY = event.nativeEvent.contentOffset.y;

    const isPastNavThreshold = offsetY > NAV_THRESHOLD;
    const isPastIdentityThreshold = offsetY > IDENTITY_THRESHOLD;

    const animations = [];

    if (isPastNavThreshold !== wasPastNavThreshold.current) {
      wasPastNavThreshold.current = isPastNavThreshold;

      animations.push(
        Animated.timing(navOpacity, {
          toValue: isPastNavThreshold ? 1 : 0,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(stickyHeaderTranslateY, {
          toValue: isPastNavThreshold ? 0 : -20,
          duration: 100,
          useNativeDriver: true,
        }),
      );
    }

    if (isPastIdentityThreshold !== wasPastIdentityThreshold.current) {
      wasPastIdentityThreshold.current = isPastIdentityThreshold;

      animations.push(
        Animated.timing(identityOpacity, {
          toValue: isPastIdentityThreshold ? 1 : 0,
          duration: 180,
          useNativeDriver: true,
        }),
      );
    }

    if (animations.length > 0) {
      Animated.parallel(animations).start();
    }
  }

  return (
    <>
      <BusinessProfileStickyHeader
        businessId={business.id}
        isPocketed={business.is_pocketed}
        businessName={business.business_name}
        coverPhotoUrl={business.cover_photo_url}
        clusterIconName={clusterIconName}
        clusterName={business.cluster.name}
        categoryName={business.category.name}
        navOpacity={navOpacity}
        identityOpacity={identityOpacity}
        translateY={stickyHeaderTranslateY}
      />

      <Animated.ScrollView
        contentContainerClassName="pb-8"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      >
        {children}
      </Animated.ScrollView>
    </>
  );
}
