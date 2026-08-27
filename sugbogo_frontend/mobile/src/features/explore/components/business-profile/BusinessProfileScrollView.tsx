import { ReactNode, useRef } from "react";
import { Animated, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";

import BusinessProfileStickyHeader from "./BusinessProfileStickyHeader";
import type { ExploreBusiness } from "../../types/exploreBusiness.types";

type Props = {
  business: ExploreBusiness;
  isRefreshing: boolean;
  onRefresh: () => void;
  children: ReactNode;
  isOwnBusiness: boolean;
};

// Calibrated against the hero's fixed h-80 (320px) height.
const NAV_THRESHOLD = 40;
const IDENTITY_THRESHOLD = 260;

/**
 * Handles the business profile's scroll behavior and two-stage sticky header
 * reveal while keeping the final content clear of the device safe area.
 */
export default function BusinessProfileScrollView({
  business,
  isRefreshing,
  onRefresh,
  children,
  isOwnBusiness,
}: Props) {
  const { bottom } = useSafeAreaInsets();

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
        isOwnBusiness={isOwnBusiness}
      />

      <Animated.ScrollView
        contentContainerStyle={{
          paddingBottom: 100,
        }}
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
