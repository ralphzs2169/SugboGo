import { ReactNode, useCallback, useRef, useState } from "react";
import {
  Animated,
  RefreshControl,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";

import BusinessProfileStickyHeader from "./BusinessProfileStickyHeader";
import type { ExploreBusiness } from "../../types/exploreBusiness.types";
import useBusinessImpressions from "../../hooks/useBusinessImpressions";
import { BusinessProfileImpressionsContext } from "../../hooks/BusinessProfileImpressionsContext";

type Props = {
  business:
    | (Pick<
        ExploreBusiness,
        | "id"
        | "business_name"
        | "cluster"
        | "category"
        | "display_cover_photo_url"
      > & {
        is_pocketed?: boolean;
      })
    | null;
  isRefreshing: boolean;
  onRefresh: () => void;
  children: ReactNode;
  isOwnBusiness: boolean;
  ownerFooterHeight?: number;
  extraBottomPadding?: number;
  impressionsEnabled?: boolean;
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
  ownerFooterHeight = 0,
  extraBottomPadding = 0,
  impressionsEnabled = true,
}: Props) {
  const { bottom } = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(0);
  const contentRef = useRef<View>(null);
  const listRef = useRef<View>(null);
  const measurementVersion = useRef(0);
  const impressions = useBusinessImpressions(
    isOwnBusiness ? ownerFooterHeight : 0,
    headerHeight,
    impressionsEnabled &&
      (!business || headerHeight > 0) &&
      (!isOwnBusiness || ownerFooterHeight > 0),
  );
  const { onSectionLayout, onListLayout } = impressions;

  const measureList = useCallback(() => {
    const list = listRef.current;
    const version = ++measurementVersion.current;
    if (!contentRef.current || !list) return;

    // Ancestor reflow can move this nested list without changing its local layout.
    onListLayout({
      nativeEvent: { layout: { x: 0, y: 0, width: 0, height: 0 } },
    } as LayoutChangeEvent);

    list.measureLayout(
      contentRef.current,
      (x, y, width, height) => {
        if (
          listRef.current !== list ||
          measurementVersion.current !== version
        ) {
          return;
        }

        onSectionLayout({
          nativeEvent: { layout: { x, y, width, height } },
        } as LayoutChangeEvent);
        onListLayout({
          nativeEvent: { layout: { x: 0, y: 0, width, height } },
        } as LayoutChangeEvent);
      },
      () => {
        if (
          listRef.current !== list ||
          measurementVersion.current !== version
        ) {
          return;
        }

        onListLayout({
          nativeEvent: { layout: { x: 0, y: 0, width: 0, height: 0 } },
        } as LayoutChangeEvent);
      },
    );
  }, [onSectionLayout, onListLayout]);

  const [navOpacity] = useState(() => new Animated.Value(0));
  const [identityOpacity] = useState(() => new Animated.Value(0));
  const [stickyHeaderTranslateY] = useState(() => new Animated.Value(-20));

  const wasPastNavThreshold = useRef(false);
  const wasPastIdentityThreshold = useRef(false);

  function handleScroll(event: any) {
    impressions.onVerticalScroll(event);
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

  const clusterIconName = business
    ? (CLUSTER_ICONS[business.cluster.icon] ?? "store")
    : "store";

  return (
    <>
      {business && (
        <BusinessProfileStickyHeader
          businessId={business.id}
          isPocketed={business.is_pocketed ?? null}
          businessName={business.business_name}
          coverPhotoUrl={business.display_cover_photo_url}
          clusterIconName={clusterIconName}
          clusterName={business.cluster.name}
          categoryName={business.category.name}
          navOpacity={navOpacity}
          identityOpacity={identityOpacity}
          translateY={stickyHeaderTranslateY}
          isOwnBusiness={isOwnBusiness}
          onShare={() => {}}
          onIdentityLayout={(event) => {
            setHeaderHeight(
              event.nativeEvent.layout.y + event.nativeEvent.layout.height,
            );
          }}
        />
      )}

      <Animated.ScrollView
        testID="business-profile-scroll"
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom:
            (isOwnBusiness ? ownerFooterHeight : bottom) + extraBottomPadding,
        }}
        onScroll={handleScroll}
        onLayout={impressions.onViewportLayout}
        onContentSizeChange={measureList}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      >
        <View ref={contentRef} collapsable={false} style={{ flexGrow: 1 }}>
          <BusinessProfileImpressionsContext.Provider
            value={{ impressions, listRef, measureList }}
          >
            {children}
          </BusinessProfileImpressionsContext.Provider>
        </View>
      </Animated.ScrollView>
    </>
  );
}
