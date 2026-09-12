import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useWindowDimensions, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";
import { formatDistance } from "@/shared/utils/distance.utils";

import type {
  ExploreBusiness,
  RecommendationReason,
} from "../../types/exploreBusiness.types";
import { arrangeSpecialtyTags } from "../../utils/arrangeSpecialtyTags.utils";

type Props = {
  business: ExploreBusiness;
  distance: number | null;
  distanceAccuracy: number | null;
  onPress: () => void;
  variant?: "default" | "featured" | "compact";
  recommendationReason?: RecommendationReason | null;
};

const CARD_WIDTH = 226;
const FEATURED_CARD_WIDTH_RATIO = 0.74;
const FEATURED_CARD_MAX_WIDTH = 360;

const HERO_HEIGHT = 190;
const COMPACT_IMAGE_SIZE = 108;
const TAG_SECTION_HEIGHT = 52;

const COMPACT_PARENT_HORIZONTAL_PADDING = 32;
const COMPACT_CARD_HORIZONTAL_PADDING = 20;
const COMPACT_CONTENT_GAP = 12;

const STANDARD_CARD_HORIZONTAL_PADDING = 24;

/** Returns the card width for horizontal card presentations. */
export function getBusinessCardWidth(
  screenWidth: number,
  variant: Exclude<Props["variant"], "compact"> = "default",
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
 * Displays a business using reusable discovery-card presentations.
 *
 * Horizontal variants support carousel discovery while the compact variant
 * provides a denser row with layout-aware specialty tag arrangement.
 */
export default function BusinessCard({
  business,
  distance,
  distanceAccuracy,
  onPress,
  variant = "default",
  recommendationReason = null,
}: Props) {
  const { width: screenWidth } = useWindowDimensions();

  const clusterIconName = CLUSTER_ICONS[business.cluster.icon] ?? "store";

  const standardVariant = variant === "featured" ? "featured" : "default";

  const standardCardWidth = getBusinessCardWidth(screenWidth, standardVariant);

  const compactTagAvailableWidth =
    screenWidth -
    COMPACT_PARENT_HORIZONTAL_PADDING -
    COMPACT_CARD_HORIZONTAL_PADDING -
    COMPACT_IMAGE_SIZE -
    COMPACT_CONTENT_GAP;

  const standardTagAvailableWidth =
    standardCardWidth - STANDARD_CARD_HORIZONTAL_PADDING;

  const tagAvailableWidth =
    variant === "compact"
      ? compactTagAvailableWidth
      : standardTagAvailableWidth;

  const displayTags = arrangeSpecialtyTags(
    business.specialty_tags,
    tagAvailableWidth,
  );

  if (variant === "compact") {
    const isRecommendation = recommendationReason !== null;

    const compactTags = isRecommendation
      ? displayTags.slice(0, 2)
      : displayTags;

    const remainingTagCount = isRecommendation
      ? Math.max(displayTags.length - compactTags.length, 0)
      : 0;

    return (
      <SafePressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={
          recommendationReason
            ? `Open ${business.business_name} business profile. ` +
              `Interested in ${recommendationReason.label}.`
            : `Open ${business.business_name} business profile`
        }
        className="w-full cursor-pointer flex-row overflow-hidden rounded-card border border-border-primary bg-surface p-2.5 active:opacity-90"
        android_ripple={{
          color: "rgba(0,0,0,0.05)",
        }}
      >
        {/* Business image */}
        <View
          style={{
            width: COMPACT_IMAGE_SIZE,
            height: COMPACT_IMAGE_SIZE,
          }}
          className="relative shrink-0 overflow-hidden rounded-xl bg-surface-secondary"
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
                size={36}
                color={theme.extends.colors.brand}
                style={{ opacity: 0.4 }}
              />
            </View>
          )}

          {/* Pocket indicator */}
          {business.is_pocketed && (
            <View className="absolute right-2 top-2 h-7 w-7 items-center justify-center rounded-full bg-white/95">
              <MaterialCommunityIcons
                name="bookmark"
                size={14}
                color={theme.extends.colors.brand}
              />
            </View>
          )}
        </View>

        {/* Business details */}
        <View className="min-w-0 flex-1 justify-between py-0.5 pl-3">
          <View>
            {/* Business identity */}
            <AppText
              weight="bold"
              className="text-[15px] leading-5 text-text-primary"
              numberOfLines={2}
            >
              {business.business_name}
            </AppText>

            {/* Category and distance */}
            <View className="mt-1.5 flex-row items-center">
              <MaterialCommunityIcons
                name={clusterIconName}
                size={13}
                color={theme.extends.colors.brand}
              />

              <AppText
                weight="medium"
                className="ml-1.5 min-w-0 flex-1 text-xs text-text-secondary"
                numberOfLines={1}
              >
                {business.category.name}
              </AppText>

              {distance !== null && (
                <View className="ml-2 shrink-0 flex-row items-center">
                  <MaterialCommunityIcons
                    name="map-marker-outline"
                    size={12}
                    color={theme.extends.colors.text.tertiary}
                  />

                  <AppText
                    className="ml-1 text-[11px] text-text-tertiary"
                    numberOfLines={1}
                  >
                    {formatDistance(distance, distanceAccuracy)}
                  </AppText>
                </View>
              )}
            </View>

            {/* Personalized recommendation context */}
            {recommendationReason && (
              <View className="mt-1.5 min-w-0 flex-row items-center">
                <MaterialCommunityIcons
                  name="creation"
                  size={12}
                  color={theme.extends.colors.brand}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />

                <AppText
                  weight="medium"
                  className="ml-1 min-w-0 flex-1 text-[11px] text-brand"
                  numberOfLines={1}
                >
                  Interested in {recommendationReason.label}
                </AppText>
              </View>
            )}
          </View>

          {/* Specialty tags */}
          {compactTags.length > 0 && (
            <View className="mt-2 flex-row flex-wrap items-center overflow-hidden">
              {compactTags.map((tag) => (
                <SpecialtyTagChip
                  key={tag.id}
                  tag={tag}
                  size="small"
                  isSelected={tag.is_vouched}
                  showVouchIndicator={tag.is_vouched}
                />
              ))}

              {remainingTagCount > 0 && (
                <View className="mb-1 mr-1 h-6 items-center justify-center rounded-full border border-border-primary bg-background px-2">
                  <AppText
                    weight="semibold"
                    className="text-[10px] text-text-secondary"
                  >
                    +{remainingTagCount}
                  </AppText>
                </View>
              )}
            </View>
          )}
        </View>
      </SafePressable>
    );
  }

  const cardWidth = getBusinessCardWidth(screenWidth, standardVariant);

  return (
    <SafePressable
      onPress={onPress}
      style={{
        width: cardWidth,
      }}
      accessibilityRole="button"
      accessibilityLabel={`Open ${business.business_name} business profile`}
      className="mb-2 mr-3 cursor-pointer rounded-card border border-border-primary bg-surface active:opacity-90"
      android_ripple={{
        color: "rgba(0,0,0,0.05)",
      }}
    >
      {/* Business photo */}
      <View
        style={{
          height: HERO_HEIGHT,
        }}
        className="relative overflow-hidden rounded-t-xl bg-surface-secondary"
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

        {/* Pocket indicator */}
        {business.is_pocketed && (
          <View className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-white/95">
            <MaterialCommunityIcons
              name="bookmark"
              size={16}
              color={theme.extends.colors.brand}
            />
          </View>
        )}
      </View>

      {/* Business content */}
      <View className="px-3 pb-3 pt-3">
        {/* Business identity */}
        <View>
          <AppText
            weight="bold"
            className="text-base leading-5 text-text-primary"
            numberOfLines={2}
          >
            {business.business_name}
          </AppText>

          {/* Specialty tags */}
          <View
            className="mt-2 flex-row flex-wrap content-start overflow-hidden"
            style={{
              height: TAG_SECTION_HEIGHT,
            }}
          >
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
        </View>

        {/* Business metadata */}
        <View className="mt-2 flex-row items-center justify-between gap-3 pb-1">
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
      </View>
    </SafePressable>
  );
}
