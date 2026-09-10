import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useWindowDimensions, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";
import { formatDistance } from "@/shared/utils/distance.utils";

import type { ExploreBusiness } from "../../types/exploreBusiness.types";

type Props = {
  business: ExploreBusiness;
  distance: number | null;
  distanceAccuracy: number | null;
  onPress: () => void;
  variant?: "default" | "featured";
};

const CARD_WIDTH = 226;
const FEATURED_CARD_WIDTH_RATIO = 0.74;
const FEATURED_CARD_MAX_WIDTH = 360;
const HERO_HEIGHT = 190;

/** Returns the card width for the selected presentation. */
export function getBusinessCardWidth(
  screenWidth: number,
  variant: Props["variant"] = "default",
) {
  if (variant === "featured") {
    return Math.min(
      Math.round(screenWidth * FEATURED_CARD_WIDTH_RATIO),
      FEATURED_CARD_MAX_WIDTH,
    );
  }

  return CARD_WIDTH;
}

/**
 * Displays a business as a reusable discovery card with inset imagery.
 *
 * Keeps business identity and specialty tags outside the photo for cleaner
 * readability while preserving category, distance, and saved-state context.
 */
export default function NewBusinessCard({
  business,
  distance,
  distanceAccuracy,
  onPress,
  variant = "default",
}: Props) {
  const { width: screenWidth } = useWindowDimensions();

  const clusterIconName = CLUSTER_ICONS[business.cluster.icon] ?? "store";
  const cardWidth = getBusinessCardWidth(screenWidth, variant);

  const arrangedSpecialtyTags = [...business.specialty_tags]
    .slice(0, 3)
    .sort((a, b) => b.name.length - a.name.length);

  const longestTag = arrangedSpecialtyTags[0];
  const shortestTag = arrangedSpecialtyTags[arrangedSpecialtyTags.length - 1];
  const middleTags = arrangedSpecialtyTags.slice(1, -1);

  const displayTags =
    arrangedSpecialtyTags.length > 1
      ? [longestTag, shortestTag, ...middleTags]
      : arrangedSpecialtyTags;

  return (
    <SafePressable
      onPress={onPress}
      style={{
        width: cardWidth,
      }}
      accessibilityRole="button"
      accessibilityLabel={`Open ${business.business_name} business profile`}
      className="mb-2 mr-3 cursor-pointer rounded-card border border-border-primary bg-surface p-2.5 active:opacity-90"
      android_ripple={{
        color: "rgba(0,0,0,0.05)",
      }}
    >
      {/* Business photo */}
      <View
        style={{
          height: HERO_HEIGHT,
        }}
        className="relative overflow-hidden rounded-t-2xl bg-surface-secondary"
      >
        {business.cover_photo_url ? (
          <Image
            source={{ uri: business.cover_photo_url }}
            style={{
              width: "100%",
              height: "100%",
            }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View className="h-full w-full items-center justify-center bg-brand/8">
            <MaterialCommunityIcons
              name={clusterIconName}
              size={48}
              color={theme.extends.colors.brand}
              style={{ opacity: 0.4 }}
            />
          </View>
        )}

        {/* Photo controls */}
        <View className="absolute right-2 top-2 flex-row items-center gap-1.5">
          {business.is_pocketed && (
            <View className="h-8 w-8 items-center justify-center rounded-full bg-white/95">
              <MaterialCommunityIcons
                name="bookmark"
                size={16}
                color={theme.extends.colors.brand}
              />
            </View>
          )}

          <View className="h-8 w-8 items-center justify-center rounded-full bg-white/95">
            <MaterialCommunityIcons
              name={clusterIconName}
              size={16}
              color={theme.extends.colors.brand}
            />
          </View>
        </View>
      </View>

      {/* Business identity */}
      <View className="px-1 pt-3">
        <AppText
          weight="bold"
          className="text-base leading-5 text-text-primary"
          numberOfLines={2}
        >
          {business.business_name}
        </AppText>

        {displayTags.length > 0 && (
          <View className="mt-2 flex-row flex-wrap ">
            {displayTags.map((tag) => (
              <SpecialtyTagChip
                key={tag.id}
                tag={tag}
                size="small"
                isSelected={tag.is_vouched}
                showVouchIndicator={tag.is_vouched}
              />
            ))}
          </View>
        )}
      </View>

      {/* Business metadata */}
      <View className="mt-3 flex-row items-center justify-between gap-3 px-1 pb-1">
        <View className="min-w-0 flex-1 flex-row items-center">
          <MaterialCommunityIcons
            name={clusterIconName}
            size={14}
            color={theme.extends.colors.brand}
          />

          <AppText
            weight="medium"
            className="ml-1.5 min-w-0 flex-1 text-xs text-text-secondary"
            numberOfLines={1}
          >
            {business.category.name}
          </AppText>
        </View>

        {distance !== null && (
          <View className="shrink-0 flex-row items-center">
            <MaterialCommunityIcons
              name="map-marker-outline"
              size={13}
              color={theme.extends.colors.text.tertiary}
            />

            <AppText
              className="ml-1 text-xs text-text-tertiary"
              numberOfLines={1}
            >
              {formatDistance(distance, distanceAccuracy)} away
            </AppText>
          </View>
        )}
      </View>
    </SafePressable>
  );
}
