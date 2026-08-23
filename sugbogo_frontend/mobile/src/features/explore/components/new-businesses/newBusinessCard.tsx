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
  onPress: () => void;
};

const CARD_WIDTH = 224; // w-56

/**
 * Displays a newly added business as a modern discovery card.
 *
 * The cover photo stays fully clean (no overlaid text) so it reads as
 * the card's visual focal point. All identity information — name,
 * category/cluster, specialty tags, and location — lives in a single
 * compact block below the photo, read top-to-bottom in priority order.
 */
export default function NewBusinessCard({
  business,
  onPress,
  distance,
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
      className="overflow-hidden rounded-xl my-1 bg-surface  active:opacity-90"
      android_ripple={{ color: "rgba(0,0,0,0.06)" }}
    >
      {/* Cover photo — kept fully clean, no overlaid text/gradient,
          so it reads as the card's visual focal point */}
      <View
        style={{ aspectRatio: 4 / 3 }}
        className="w-full overflow-hidden bg-surface-secondary"
      >
        {business.cover_photo_url ? (
          <Image
            source={{ uri: business.cover_photo_url }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          // Intentional placeholder: tinted with the business's own
          // cluster identity rather than a generic empty-image icon,
          // so an unphotographed listing still feels branded, not broken.
          <View className="h-full w-full items-center justify-center bg-brand/8">
            <MaterialCommunityIcons
              name={clusterIconName}
              size={40}
              color={theme.extends.colors.brand}
              style={{ opacity: 0.45 }}
            />
          </View>
        )}
      </View>

      {/* Identity block — name → category/cluster → tags → location,
          read in one continuous top-to-bottom hierarchy */}
      <View className="px-3.5 pb-3.5 pt-2.5">
        {/* Business name — primary focal text */}
        <Text
          className="text-[15px] font-bold leading-[19px] text-text-primary"
          numberOfLines={1}
        >
          {business.business_name}
        </Text>

        {/* Cluster + category — paired on one line, matching hierarchy */}
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

        {/* Specialty tags — always shown in full. Every business has
            exactly 3 (enforced at registration: specialtyTags requires
            length 3), so there's no realistic overflow case to design
            around. flex-wrap is kept only as a defensive fallback if
            that constraint ever changes, not as the expected path.
            Renders nothing at all when there are no tags, rather than
            leaving a dead gap in the card's rhythm. */}
        {business.specialty_tags.length > 0 && (
          <View className="mt-2 flex-row flex-wrap items-center">
            {business.specialty_tags.map((tag) => (
              <SpecialtyTagChip key={tag.id} tag={tag} size="small" />
            ))}
          </View>
        )}

        {/* Distance */}
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
            {distance !== null
              ? formatDistance(distance)
              : business.location.city}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
