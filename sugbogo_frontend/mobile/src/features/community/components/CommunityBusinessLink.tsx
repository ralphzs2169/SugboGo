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
 * Connects a Community review to its associated business.
 *
 * Uses a subtle elbow arrow to visually associate the review with the
 * business while keeping the row compact and fully pressable.
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

  const details = [business.category.name, business.address]
    .filter(Boolean)
    .join(" · ");

  return (
    <SafePressable
      testID={`community-business-${business.id}`}
      onPress={openBusiness}
      accessibilityRole="button"
      accessibilityLabel={`Open ${business.business_name} business profile`}
      className="min-h-12 flex-row items-center active:opacity-70"
    >
      {/* Review-to-business connector */}
      <View className="mr-2 items-center justify-center">
        <MaterialCommunityIcons
          name="subdirectory-arrow-right"
          size={21}
          color={theme.extends.colors.text.tertiary}
        />
      </View>

      {/* Business thumbnail */}
      <View className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-background">
        {business.display_cover_photo_url ? (
          <Image
            source={{ uri: business.display_cover_photo_url }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <MaterialCommunityIcons
              name="storefront-outline"
              size={18}
              color={theme.extends.colors.text.secondary}
            />
          </View>
        )}
      </View>

      {/* Business identity */}
      <View className="ml-2.5 min-w-0 flex-1">
        <AppText
          weight="medium"
          className="text-[13px] text-text-primary"
          numberOfLines={1}
        >
          {business.business_name}
        </AppText>

        {!!details && (
          <AppText
            className="mt-0.5 text-[11px] text-text-secondary"
            numberOfLines={1}
          >
            {details}
          </AppText>
        )}
      </View>
    </SafePressable>
  );
}
