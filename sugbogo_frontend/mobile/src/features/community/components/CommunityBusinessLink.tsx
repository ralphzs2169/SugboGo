import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import { CLUSTER_ICONS } from "@/shared/constants/clusterIcons";

import type { CommunityReviewBusiness } from "../types/communityReview.types";

type Props = {
  business: CommunityReviewBusiness;
};

/** Falls back to the existing storefront placeholder for a failed cover URL. */
function BusinessThumbnail({ url }: { url: string | null }) {
  const [hasFailed, setHasFailed] = useState(false);

  return (
    <View className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-background">
      {url && !hasFailed ? (
        <Image
          source={{ uri: url }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          transition={150}
          onError={() => setHasFailed(true)}
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
  );
}

/**
 * Connects a Community review to its associated business.
 *
 * Uses a subtle elbow arrow to associate the review with the business,
 * while a trailing chevron reinforces the row's navigation behavior.
 */
export default function CommunityBusinessLink({ business }: Props) {
  const openBusiness = () => {
    router.push({
      pathname: "/(explorer)/business/[businessId]",
      params: {
        businessId: String(business.id),
        profileSource: "COMMUNITY",
      },
    });
  };

  const clusterIconName = business.cluster_icon
    ? CLUSTER_ICONS[business.cluster_icon]
    : undefined;
  const details = [business.category.name, business.barangay?.trim()]
    .filter(Boolean)
    .join(" · ");

  return (
    <SafePressable
      testID={`community-business-${business.id}`}
      onPress={openBusiness}
      accessibilityRole="button"
      accessibilityLabel={`Open ${business.business_name} business profile`}
      className="min-h-12 cursor-pointer flex-row items-center active:opacity-70"
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
      <BusinessThumbnail
        key={business.display_cover_photo_url}
        url={business.display_cover_photo_url}
      />

      {/* Business identity */}
      <View className="ml-2.5 min-w-0 flex-1">
        <AppText
          weight="medium"
          className="text-[13px] text-text-primary"
          numberOfLines={1}
        >
          {business.business_name}
        </AppText>

        {(!!clusterIconName || !!details) && (
          <View className="mt-0.5 flex-row items-center">
            {clusterIconName && (
              <MaterialCommunityIcons
                name={clusterIconName}
                size={12}
                color={theme.extends.colors.text.tertiary}
                style={{ marginRight: details ? 4 : 0 }}
              />
            )}
            {!!details && (
              <AppText
                className="min-w-0 flex-1 text-[11px] text-text-secondary"
                numberOfLines={1}
              >
                {details}
              </AppText>
            )}
          </View>
        )}
      </View>

      {/* Navigation chevron */}
      <MaterialCommunityIcons
        name="chevron-right"
        size={20}
        color={theme.extends.colors.text.tertiary}
      />
    </SafePressable>
  );
}
