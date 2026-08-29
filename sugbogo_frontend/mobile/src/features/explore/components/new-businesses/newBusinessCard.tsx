import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Text, View } from "react-native";

import { theme } from "@/constants/theme";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";

import type { ExploreBusiness } from "../../types/exploreBusiness.types";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import { formatDistance } from "@/shared/utils/distance.utils";
import SafePressable from "@/shared/components/SafePressable";

type Props = {
  business: ExploreBusiness;
  distance: number | null;
  distanceAccuracy: number | null;
  onPress: () => void;
};

const CARD_WIDTH = 226;
const HERO_HEIGHT = 276;

/**
 * Displays a newly added business as a photo-led discovery card.
 *
 * Uses a tall cover-photo hero with a gradient scrim to keep business
 * identity and specialty tags readable. The outer card provides the
 * elevation and shadow while the inner container clips the visual content.
 */
export default function NewBusinessCard({
  business,
  distance,
  distanceAccuracy,
  onPress,
}: Props) {
  const clusterIconName = CLUSTER_ICONS[business.cluster.icon] ?? "store";

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
        width: CARD_WIDTH,
      }}
      className="mr-3 rounded-card bg-surface active:opacity-90 mb-2 border border-border-primary"
      android_ripple={{ color: "rgba(0,0,0,0.06)" }}
    >
      <View className="overflow-hidden rounded-card">
        {/* Hero photo */}
        <View
          style={{
            height: HERO_HEIGHT,
            width: "100%",
          }}
          className="relative overflow-hidden bg-surface-secondary"
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
                size={56}
                color={theme.extends.colors.brand}
                style={{ opacity: 0.45 }}
              />
            </View>
          )}

          {/* Photo readability gradient */}
          <LinearGradient
            colors={[
              "transparent",
              "rgba(0,0,0,0.05)",
              "rgba(0,0,0,0.3)",
              "rgba(0,0,0,0.78)",
            ]}
            locations={[0, 0.4, 0.7, 1]}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 250,
            }}
            pointerEvents="none"
          />

          {/* Hero controls */}
          <View className="absolute right-2 top-2 flex-row items-center gap-1">
            {business.is_pocketed && (
              <View className="h-8 w-8 items-center justify-center rounded-full bg-white">
                <MaterialCommunityIcons
                  name="bookmark"
                  size={17}
                  color={theme.extends.colors.brand}
                />
              </View>
            )}

            <View className="h-8 w-8 items-center justify-center rounded-full bg-white">
              <MaterialCommunityIcons
                name={clusterIconName}
                size={16}
                color={theme.extends.colors.brand}
              />
            </View>
          </View>

          {/* Business identity */}
          <View className="absolute bottom-2 left-3 right-3">
            <Text className="text-md font-bold text-white" numberOfLines={2}>
              {business.business_name}
            </Text>

            {displayTags.length > 0 && (
              <View className="mt-1.5 flex-row flex-wrap gap-1">
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
        </View>

        {/* Card footer */}
        <View className="flex-row items-center bg-surface px-3 py-2.5">
          {/* Category */}
          <View className="flex-1 flex-row items-center">
            <MaterialCommunityIcons
              name={clusterIconName}
              size={14}
              color={theme.extends.colors.brand}
            />

            <Text
              className="ml-1.5 text-xs font-medium text-text-secondary"
              numberOfLines={1}
            >
              {business.category.name}
            </Text>
          </View>

          {/* Distance */}
          {distance !== null && (
            <View className="ml-2 flex-row items-center">
              <MaterialCommunityIcons
                name="map-marker-outline"
                size={12}
                color={theme.extends.colors.text.tertiary}
              />

              <Text
                className="ml-1 text-xs text-text-tertiary"
                numberOfLines={1}
              >
                {formatDistance(distance, distanceAccuracy)} away
              </Text>
            </View>
          )}
        </View>
      </View>
    </SafePressable>
  );
}
