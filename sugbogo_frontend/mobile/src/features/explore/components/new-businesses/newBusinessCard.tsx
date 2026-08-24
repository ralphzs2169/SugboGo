import { Text, View, Pressable } from "react-native";
import { Image } from "expo-image";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { theme } from "@/constants/theme";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";

import type { ExploreBusiness } from "../../types/exploreBusiness.types";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import { formatDistance } from "@/shared/utils/distance.utils";

type Props = {
  business: ExploreBusiness;
  distance: number | null;
  distanceAccuracy: number | null;
  onPress: () => void;
};

const CARD_WIDTH = 248;

/**
 * Displays a newly added business as a discovery card.
 *
 * Uses the cover photo as the primary visual element, with business identity,
 * specialty information, and distance presented below. The Pocket state is
 * surfaced directly on the cover so saved businesses are recognizable while
 * browsing the discovery feed.
 */
export default function NewBusinessCard({
  business,
  onPress,
  distance,
  distanceAccuracy,
}: Props) {
  const clusterIconName = CLUSTER_ICONS[business.cluster.icon] ?? "store";

  return (
    <Pressable
      onPress={onPress}
      style={{
        width: CARD_WIDTH,
        shadowColor: "#000",
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
      }}
      className="my-1 overflow-hidden rounded-xl bg-surface active:opacity-90"
      android_ripple={{ color: "rgba(0,0,0,0.06)" }}
    >
      {/* Cover photo */}
      <View
        style={{ aspectRatio: 4 / 3 }}
        className="relative w-full overflow-hidden bg-surface-secondary"
      >
        {business.cover_photo_url ? (
          <Image
            source={{ uri: business.cover_photo_url }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View className="h-full w-full items-center justify-center bg-brand/8">
            <MaterialCommunityIcons
              name={clusterIconName}
              size={40}
              color={theme.extends.colors.brand}
              style={{ opacity: 0.45 }}
            />
          </View>
        )}

        {/* Pocket indicator */}
        {business.is_pocketed && (
          <View className="absolute right-2.5 top-2.5 h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-sm">
            <MaterialCommunityIcons
              name="bookmark"
              size={19}
              color={theme.extends.colors.brand}
            />
          </View>
        )}
      </View>

      {/* Business identity */}
      <View className="px-3.5 pb-3.5 pt-2.5">
        {/* Business name */}
        <Text
          className="text-[15px] font-bold leading-[19px] text-text-primary"
          numberOfLines={1}
        >
          {business.business_name}
        </Text>

        {/* Cluster + category */}
        <View className="mt-1 flex-row items-center">
          <MaterialCommunityIcons
            name={clusterIconName}
            size={13}
            color={theme.extends.colors.brand}
          />

          <Text
            className="ml-1 flex-1 text-[12px] font-medium text-text-secondary"
            numberOfLines={1}
          >
            {business.category.name}
          </Text>
        </View>

        {/* Specialty tags */}
        {business.specialty_tags.length > 0 && (
          <View className="mt-2 flex-row flex-wrap items-center">
            {business.specialty_tags.map((tag) => (
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

        {/* Distance */}
        {distance !== null && (
          <View className="mt-2 flex-row items-center">
            <MaterialCommunityIcons
              name="map-marker-outline"
              size={12}
              color={theme.extends.colors.text.tertiary}
            />

            <Text
              className="ml-1 flex-1 text-[11px] text-text-tertiary"
              numberOfLines={1}
            >
              {formatDistance(distance, distanceAccuracy)}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
