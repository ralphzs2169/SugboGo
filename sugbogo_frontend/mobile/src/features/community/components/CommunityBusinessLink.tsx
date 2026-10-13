import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";

import type { CommunityReviewBusiness } from "../types/communityReview.types";

type Props = {
  business: CommunityReviewBusiness;
};

/**
 * Links a Community review to its Explorer business profile.
 *
 * The full business row is pressable and retains useful identity and location
 * context even when the business does not have a display cover photo.
 */
export default function CommunityBusinessLink({ business }: Props) {
  const openBusiness = () => {
    router.push({
      pathname: "/(explorer)/business/[businessId]",
      params: {
        businessId: String(business.id),
      },
    });
  };

  return (
    <SafePressable
      testID={`community-business-${business.id}`}
      onPress={openBusiness}
      accessibilityRole="button"
      accessibilityLabel={`Open ${business.business_name} business profile`}
      className="mt-3 cursor-pointer flex-row items-center rounded-xl border border-border-primary bg-background p-2.5 active:opacity-80"
    >
      {/* Business cover */}
      <View className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-surface-muted">
        {business.display_cover_photo_url ? (
          <Image
            source={{ uri: business.display_cover_photo_url }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View className="h-full w-full items-center justify-center bg-brand/10">
            <MaterialCommunityIcons
              name="storefront-outline"
              size={24}
              color={theme.extends.colors.brand}
            />
          </View>
        )}
      </View>

      {/* Business identity */}
      <View className="ml-3 min-w-0 flex-1">
        <AppText
          weight="bold"
          className="text-sm text-text-primary"
          numberOfLines={1}
        >
          {business.business_name}
        </AppText>

        <AppText
          weight="medium"
          className="mt-0.5 text-xs text-text-secondary"
          numberOfLines={1}
        >
          {business.category.name}
        </AppText>

        {!!business.address && (
          <View className="mt-1 flex-row items-center">
            <MaterialCommunityIcons
              name="map-marker-outline"
              size={12}
              color={theme.extends.colors.text.secondary}
            />
            <AppText
              className="ml-1 min-w-0 flex-1 text-[11px] text-text-secondary"
              numberOfLines={1}
            >
              {business.address}
            </AppText>
          </View>
        )}
      </View>

      {/* Navigation affordance */}
      <MaterialCommunityIcons
        name="chevron-right"
        size={20}
        color={theme.extends.colors.text.tertiary}
      />
    </SafePressable>
  );
}
