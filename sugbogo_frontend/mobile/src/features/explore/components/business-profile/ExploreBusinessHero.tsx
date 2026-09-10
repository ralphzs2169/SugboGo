import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";
import AppText from "@/shared/components/AppText";

import BusinessPocketButton from "./BusinessPocketButton";
import type { ExploreBusiness } from "../../types/exploreBusiness.types";

type Props = {
  business: ExploreBusiness;
  isOwnBusiness: boolean;
};

/**
 * Displays the business cover photo and primary identity information.
 *
 * The business identity is anchored to the bottom of the hero with a subtle
 * gradient scrim so the cover photo remains the primary visual element while
 * the text stays readable. The top-right Pocket action allows the explorer
 * to save or remove the business from their Pocket.
 */
export default function ExploreBusinessHero({
  business,
  isOwnBusiness,
}: Props) {
  const clusterIconName = CLUSTER_ICONS[business.cluster.icon] ?? "store";

  return (
    <View className="relative h-72 w-full bg-surface-secondary">
      {/* Cover photo */}
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
            name="store-outline"
            size={64}
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
          "rgba(0,0,0,0.75)",
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

      {/* Navigation and Pocket controls */}
      <View className="absolute left-4 right-4 top-4 flex-row items-center justify-between">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/95 active:opacity-80"
          android_ripple={{ color: "rgba(0,0,0,0.08)" }}
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={26}
            color={theme.extends.colors.text.primary}
          />
        </Pressable>

        <BusinessPocketButton
          businessId={business.id}
          isPocketed={business.is_pocketed}
        />
      </View>

      {/* Business identity */}
      <View className="absolute bottom-5 left-4 right-4">
        {isOwnBusiness && (
          <View className="mb-2 flex-row items-center self-start rounded-full bg-brand px-2.5 py-1">
            <MaterialCommunityIcons
              name="store-check-outline"
              size={12}
              color="#FFFFFF"
            />
            <AppText
              weight="bold"
              className="ml-1 text-[10px] uppercase tracking-wide text-white"
            >
              Your Business
            </AppText>
          </View>
        )}

        <AppText
          weight="bold"
          className="text-2xl text-white"
          numberOfLines={2}
        >
          {business.business_name}
        </AppText>

        <View className="mt-1.5 flex-row items-center">
          <MaterialCommunityIcons
            name={clusterIconName}
            size={16}
            color="#FFFFFF"
          />

          <AppText
            weight="medium"
            className="ml-1.5 flex-1 text-sm text-white/90"
            numberOfLines={1}
          >
            {business.cluster.name} · {business.category.name}
          </AppText>
        </View>
      </View>
    </View>
  );
}
