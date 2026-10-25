import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import type { LocationObject } from "expo-location";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import HiddenGemBadge from "@/shared/components/HiddenGemBadge";
import SafePressable from "@/shared/components/SafePressable";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";
import { shadows } from "@/shared/styles/shadows";
import {
  calculateDistanceInKm,
  formatDistance,
} from "@/shared/utils/distance.utils";

import type { BusinessImpressionObservation } from "../../hooks/useBusinessImpressions";
import type { ExploreBusiness } from "../../types/exploreBusiness.types";
import ExploreSectionHeader from "../ExploreSectionHeader";

type Props = {
  business: ExploreBusiness;
  impressions: BusinessImpressionObservation;
  userLocation: LocationObject | null;
  onCoverError: () => void;
  onPress: (
    businessId: number,
    distance: number | null,
    accuracy: number | null,
  ) => void;
};

/** Spotlights the leading discovery result with a readable photo overlay and measured visibility. */
export default function HiddenGemSpotlight({
  business,
  impressions,
  userLocation,
  onCoverError,
  onPress,
}: Props) {
  const { retainBusinesses } = impressions;
  useEffect(() => {
    retainBusinesses([business.id]);
    return () => retainBusinesses([]);
  }, [business.id, retainBusinesses]);

  const distance = userLocation
    ? calculateDistanceInKm(
        userLocation.coords.latitude,
        userLocation.coords.longitude,
        business.location.latitude,
        business.location.longitude,
      )
    : null;
  const accuracy = userLocation?.coords.accuracy ?? null;

  return (
    <View
      className="bg-surface pt-6 pb-2"
      onLayout={impressions.onSectionLayout}
      testID="hidden-gem-spotlight"
    >
      <ExploreSectionHeader
        title="Hidden Gem Spotlight"
        subtitle="Great local places that deserve more discovery."
      />

      {/* Keep card coordinates relative to its measured viewport. */}
      <View className="mx-4" onLayout={impressions.onListLayout}>
        <View
          collapsable={false}
          className="rounded-card bg-surface"
          style={shadows.subtle}
          onLayout={(event) => impressions.onCardLayout(business.id, event)}
        >
          <SafePressable
            onPress={() => onPress(business.id, distance, accuracy)}
            accessibilityRole="button"
            accessibilityLabel={`Explore ${business.business_name}, ${business.category.name}`}
            className="w-full cursor-pointer overflow-hidden rounded-card bg-surface-muted active:opacity-90"
          >
            {/* Content sets a minimum height and can grow with larger system text. */}
            <Image
              source={{ uri: business.display_cover_photo_url! }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              onError={onCoverError}
              accessible={false}
            />
            <LinearGradient
              colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.58)", "rgba(0,0,0,0.94)"]}
              locations={[0, 0.35, 1]}
              style={[StyleSheet.absoluteFill, { top: "35%" }]}
              pointerEvents="none"
            />
            <View className="min-h-72 justify-end px-4 pb-4 pt-24">
              <AppText
                weight="bold"
                className="text-xl leading-7 text-white"
                numberOfLines={2}
              >
                {business.business_name}
              </AppText>
              {business.specialty_tags.length > 0 && (
                <View className="mt-3 flex-row flex-wrap">
                  {business.specialty_tags.map((tag) => (
                    <SpecialtyTagChip
                      key={tag.id}
                      tag={tag}
                      mode="display"
                      size="small"
                      showIcon
                    />
                  ))}
                </View>
              )}
              <View className="mt-2 flex-row flex-wrap items-center justify-between gap-2">
                <AppText weight="semibold" className="text-sm text-white">
                  Explore this place
                </AppText>
                <View className="flex-row items-center gap-3">
                  {distance !== null && (
                    <View className="flex-row items-center gap-1">
                      <MaterialCommunityIcons
                        name="map-marker-outline"
                        size={13}
                        color={theme.extends.colors.surface}
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                      />
                      <AppText className="text-xs text-white">
                        {formatDistance(distance, accuracy)}
                      </AppText>
                    </View>
                  )}
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-brand">
                    <MaterialCommunityIcons
                      name="arrow-right"
                      size={18}
                      color={theme.extends.colors.surface}
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                    />
                  </View>
                </View>
              </View>
            </View>
            {/* Leave room for the gem badge at the opposite photo corner. */}
            <View className="absolute right-3 top-3 max-w-[70%] flex-row items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-2">
              <MaterialCommunityIcons
                name={CLUSTER_ICONS[business.cluster.icon] ?? "store"}
                size={13}
                color={theme.extends.colors.brand}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
              <AppText
                weight="semibold"
                className="shrink text-[11px] text-white"
                numberOfLines={1}
              >
                {business.category.name}
              </AppText>
            </View>
          </SafePressable>
          <HiddenGemBadge />
        </View>
      </View>
    </View>
  );
}
