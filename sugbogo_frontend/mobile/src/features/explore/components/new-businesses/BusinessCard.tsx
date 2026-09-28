import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useWindowDimensions, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";
import { shadows } from "@/shared/styles/shadows";
import { formatDistance } from "@/shared/utils/distance.utils";

import type {
  ExploreBusiness,
  RecommendationReason,
} from "../../types/exploreBusiness.types";
import { arrangeSpecialtyTags } from "../../utils/arrangeSpecialtyTags.utils";
import {
  OVERALL_REVIEW_VIBE_LABELS,
  OVERALL_REVIEW_VIBE_STYLES,
} from "../../utils/reviewVibe.utils";

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

const HERO_HEIGHT = 200;
const COMPACT_IMAGE_SIZE = 108;
const TAG_SECTION_HEIGHT = 52;

const COMPACT_PARENT_HORIZONTAL_PADDING = 32;
const COMPACT_CARD_HORIZONTAL_PADDING = 20;
const COMPACT_CONTENT_GAP = 12;

const STANDARD_CARD_PADDING = 10;
const COMPACT_VISIBLE_TAG_COUNT = 2;

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
 * Horizontal variants prioritize the business image, identity, specialties,
 * and review vibe. Category and distance are presented over the image to keep
 * the content surface easy to scan.
 *
 * The compact variant provides a denser row with secondary metadata and a
 * maximum of two visible specialty tags.
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
    standardCardWidth - STANDARD_CARD_PADDING * 2;

  const tagAvailableWidth =
    variant === "compact"
      ? compactTagAvailableWidth
      : standardTagAvailableWidth;

  const displayTags = arrangeSpecialtyTags(
    business.specialty_tags,
    tagAvailableWidth,
  );

  const overallVibeLabel = business.overall_vibe
    ? OVERALL_REVIEW_VIBE_LABELS[business.overall_vibe]
    : null;

  const overallVibeStyle = business.overall_vibe
    ? OVERALL_REVIEW_VIBE_STYLES[business.overall_vibe]
    : null;

  if (variant === "compact") {
    const compactTags = displayTags.slice(0, COMPACT_VISIBLE_TAG_COUNT);

    const remainingTagCount = Math.max(
      displayTags.length - compactTags.length,
      0,
    );

    return (
      <SafePressable
        onPress={onPress}
        style={shadows.subtle}
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
            <View className="absolute right-2 top-2 h-7 w-7 items-center justify-center rounded-md bg-black/65">
              <MaterialCommunityIcons
                name="bookmark"
                size={15}
                color="#FFFFFF"
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

            {/* Business metadata */}
            <View className="mt-1 flex-row items-center">
              <MaterialCommunityIcons
                name={clusterIconName}
                size={12}
                color={theme.extends.colors.text.tertiary}
              />

              <AppText
                weight="medium"
                className="ml-1 min-w-0 flex-1 text-[11px] text-text-secondary"
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
                  showIcon
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
      style={[
        {
          width: cardWidth,
        },
        shadows.subtle,
      ]}
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
        className="relative overflow-hidden rounded-xl bg-surface-secondary"
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
          <View className="absolute right-2 top-2 h-7 w-7 items-center justify-center rounded-md bg-black/65">
            <MaterialCommunityIcons name="bookmark" size={16} color="#FFFFFF" />
          </View>
        )}

        {/* Image metadata */}
        <View className="absolute bottom-0 left-0 right-0 h-9 flex-row items-center justify-between bg-black/65">
          {/* Category */}
          <View className="ml-2.5 min-w-0 flex-1 flex-row items-center">
            <MaterialCommunityIcons
              name={clusterIconName}
              size={13}
              color={theme.extends.colors.brand}
            />

            <AppText
              weight="semibold"
              className="ml-1.5 min-w-0 flex-1 text-[11px] text-white"
              numberOfLines={1}
            >
              {business.category.name}
            </AppText>
          </View>

          {/* Distance */}
          {distance !== null && (
            <View className="mr-2.5 ml-2 shrink-0 flex-row items-center">
              <MaterialCommunityIcons
                name="map-marker-outline"
                size={13}
                color="#FFFFFF"
              />

              <AppText
                weight="semibold"
                className="ml-1 text-[11px] text-white"
                numberOfLines={1}
              >
                {formatDistance(distance, distanceAccuracy)}
              </AppText>
            </View>
          )}
        </View>
      </View>

      {/* Business content */}
      <View className="pb-1 pt-3">
        {/* Business identity */}
        <AppText
          weight="bold"
          className="text-base leading-5 text-text-primary"
          numberOfLines={2}
        >
          {business.business_name}
        </AppText>

        {/* Specialty tags */}
        {displayTags.length > 0 && (
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
                showIcon
              />
            ))}
          </View>
        )}

        {/* Review metadata */}
        <View className="mt-2 flex-row items-center border-t border-border-primary pt-2.5">
          {business.review_count === 0 ? (
            <View className="flex-row items-center">
              <MaterialCommunityIcons
                name="message-text-outline"
                size={13}
                color={theme.extends.colors.text.tertiary}
              />

              <AppText className="ml-1.5 text-xs text-text-tertiary">
                No reviews yet
              </AppText>
            </View>
          ) : (
            <>
              {/* Review count */}
              <View className="flex-row items-center">
                <MaterialCommunityIcons
                  name="message-text-outline"
                  size={13}
                  color={theme.extends.colors.text.secondary}
                />

                <AppText
                  weight="semibold"
                  className="ml-1.5 text-xs text-text-secondary"
                >
                  {business.review_count}{" "}
                  {business.review_count === 1 ? "review" : "reviews"}
                </AppText>
              </View>

              {/* Overall visitor vibe */}
              {overallVibeLabel && overallVibeStyle && (
                <View className="ml-2 min-w-0 shrink flex-row items-center">
                  <View
                    className={`h-2 w-2 shrink-0 rounded-full ${overallVibeStyle.containerClassName}`}
                  />

                  <AppText
                    weight="medium"
                    className="ml-1.5 shrink text-[11px] text-text-secondary"
                    numberOfLines={1}
                  >
                    {overallVibeLabel}
                  </AppText>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </SafePressable>
  );
}
