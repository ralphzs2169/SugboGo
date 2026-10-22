import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import type { ReactNode } from "react";
import { useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

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
  onPocketPress?: () => void;
  pocketActionDisabled?: boolean;
  compactTrailingAction?: ReactNode;
  variant?: "default" | "featured" | "compact";
  recommendationReason?: RecommendationReason | null;
};

const CARD_WIDTH = 226;
const FEATURED_CARD_WIDTH_RATIO = 0.74;
const FEATURED_CARD_MAX_WIDTH = 360;

const HERO_HEIGHT = 200;
const TAG_SECTION_HEIGHT = 52;

const COMPACT_PARENT_HORIZONTAL_PADDING = 32;

const STANDARD_CONTENT_HORIZONTAL_PADDING = 12;

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
 * Standard and featured variants use an edge-to-edge cover image followed by
 * padded business details, while the compact variant provides a denser row
 * presentation with secondary metadata and wrapping specialty tags.
 */
export default function BusinessCard({
  business,
  distance,
  distanceAccuracy,
  onPress,
  onPocketPress,
  pocketActionDisabled = false,
  compactTrailingAction,
  variant = "default",
  recommendationReason = null,
}: Props) {
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const cover =
    business.display_cover_photo_url !== failedCover
      ? business.display_cover_photo_url
      : null;
  const { width: screenWidth } = useWindowDimensions();
  const compactImageWidth = Math.min(
    176,
    Math.max(
      128,
      Math.round((screenWidth - COMPACT_PARENT_HORIZONTAL_PADDING) * 0.44),
    ),
  );

  const clusterIconName = CLUSTER_ICONS[business.cluster.icon] ?? "store";

  const standardVariant = variant === "featured" ? "featured" : "default";

  const standardCardWidth = getBusinessCardWidth(screenWidth, standardVariant);

  const standardTagAvailableWidth =
    standardCardWidth - STANDARD_CONTENT_HORIZONTAL_PADDING * 2;

  const displayTags = arrangeSpecialtyTags(
    business.specialty_tags,
    standardTagAvailableWidth,
  );

  const overallVibeLabel = business.overall_vibe
    ? OVERALL_REVIEW_VIBE_LABELS[business.overall_vibe]
    : null;

  const overallVibeStyle = business.overall_vibe
    ? OVERALL_REVIEW_VIBE_STYLES[business.overall_vibe]
    : null;

  // A sibling action keeps bookmark taps separate from profile navigation.
  const pocketAction = onPocketPress ? (
    <SafePressable
      onPress={onPocketPress}
      disabled={pocketActionDisabled}
      accessibilityRole="button"
      accessibilityLabel={
        business.is_pocketed
          ? `Edit Pocket collections for ${business.business_name}`
          : `Save ${business.business_name} to Pockets`
      }
      accessibilityState={{ disabled: pocketActionDisabled }}
      className="absolute top-2 h-12 w-12 cursor-pointer items-center justify-center rounded-xl active:opacity-80"
      style={
        variant === "compact" ? { left: compactImageWidth - 44 } : { right: 8 }
      }
    >
      <View
        pointerEvents="none"
        className={`h-8 w-8 items-center justify-center rounded-md ${business.is_pocketed ? "bg-brand" : "bg-gray-500"}`}
      >
        <MaterialCommunityIcons
          name={business.is_pocketed ? "bookmark" : "bookmark-outline"}
          size={20}
          color="#FFFFFF"
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </View>
    </SafePressable>
  ) : null;

  if (variant === "compact") {
    const compactTags = business.specialty_tags;

    return (
      <View className="relative w-full">
        <SafePressable
          onPress={onPress}
          // style={shadows.subtle}
          accessibilityRole="button"
          accessibilityLabel={
            recommendationReason
              ? `Open ${business.business_name} business profile. ` +
                `Interested in ${recommendationReason.label}.`
              : `Open ${business.business_name} business profile`
          }
          className="min-h-40 w-full cursor-pointer flex-row overflow-hidden rounded-card border border-border-primary bg-surface active:opacity-90"
          android_ripple={{
            color: "rgba(0,0,0,0.05)",
          }}
        >
          {/* Business image */}
          <View
            style={{
              width: compactImageWidth,
            }}
            className="relative min-h-40 shrink-0 self-stretch overflow-hidden bg-surface-muted"
          >
            {cover ? (
              <Image
                source={{ uri: cover }}
                onError={() => setFailedCover(cover)}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={150}
              />
            ) : (
              <View
                style={StyleSheet.absoluteFill}
                className="items-center justify-center bg-brand/8"
              >
                <MaterialCommunityIcons
                  name={clusterIconName}
                  size={36}
                  color={theme.extends.colors.brand}
                  style={{ opacity: 0.4 }}
                />
              </View>
            )}

            {business.is_pocketed && !onPocketPress && (
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
          <View className="min-h-40 min-w-0 flex-1 justify-between p-3">
            <View>
              <AppText
                weight="bold"
                className="text-[13px] leading-5 text-text-primary"
                style={
                  compactTrailingAction
                    ? { paddingRight: 48, minHeight: 40 }
                    : undefined
                }
                numberOfLines={2}
              >
                {business.business_name}
              </AppText>

              <View className="mt-1 flex-row items-center">
                <MaterialCommunityIcons
                  name={clusterIconName}
                  size={12}
                  color={theme.extends.colors.text.tertiary}
                />

                <AppText
                  weight="medium"
                  className="ml-1 min-w-0 flex-1 text-[10px] text-text-secondary"
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
                      className="ml-1 text-[10px] text-text-tertiary"
                      numberOfLines={1}
                    >
                      {formatDistance(distance, distanceAccuracy)}
                    </AppText>
                  </View>
                )}
              </View>

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
              <View className="mt-2 flex-row flex-wrap items-center">
                {compactTags.map((tag) => (
                  <SpecialtyTagChip
                    key={tag.id}
                    tag={tag}
                    size="xs"
                    isSelected={tag.is_vouched}
                    showVouchIndicator={tag.is_vouched}
                    showIcon
                  />
                ))}
              </View>
            )}
          </View>
        </SafePressable>
        {pocketAction}
        {compactTrailingAction && (
          <View className="absolute right-1 top-1">
            {compactTrailingAction}
          </View>
        )}
      </View>
    );
  }

  const cardWidth = getBusinessCardWidth(screenWidth, standardVariant);

  return (
    <View
      className="mb-2 mr-3 rounded-card bg-surface"
      style={[
        {
          width: cardWidth,
        },
        shadows.subtle,
      ]}
    >
      <SafePressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Open ${business.business_name} business profile`}
        className="w-full cursor-pointer overflow-hidden rounded-card border border-border-primary bg-surface active:opacity-90"
        android_ripple={{
          color: "rgba(0,0,0,0.05)",
        }}
      >
        {/* Edge-to-edge business photo */}
        <View
          style={{
            height: HERO_HEIGHT,
          }}
          className="relative w-full bg-surface-secondary"
        >
          {cover ? (
            <Image
              source={{ uri: cover }}
              onError={() => setFailedCover(cover)}
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

          {business.is_pocketed && !onPocketPress && (
            <View className="absolute right-2.5 top-2.5 h-7 w-7 items-center justify-center rounded-md bg-black/65">
              <MaterialCommunityIcons
                name="bookmark"
                size={16}
                color="#FFFFFF"
              />
            </View>
          )}

          {/* Image metadata */}
          <View className="absolute bottom-0 left-0 right-0 h-9 flex-row items-center justify-between bg-black/65">
            <View className="ml-3 min-w-0 flex-1 flex-row items-center">
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

            {distance !== null && (
              <View className="ml-2 mr-3 shrink-0 flex-row items-center">
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
        <View className="px-3 pb-3 pt-3">
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
      {pocketAction}
    </View>
  );
}
