import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { memo } from "react";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import MerchantReviewResponse from "@/features/explore/components/business-profile/reviews/MerchantReviewResponse";
import ReviewContent from "@/features/explore/components/business-profile/reviews/ReviewContent";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";

import type { MyReview } from "../../types/myReview.types";

const statusPresentation = {
  published: {
    label: "Published",
    className: "bg-surface-muted text-text-secondary",
  },
  under_review: { label: "Under review", className: "bg-info text-text-info" },
  rejected: {
    label: "Not published",
    className: "bg-surface-muted text-text-secondary",
  },
  flagged: {
    label: "Not published",
    className: "bg-surface-muted text-text-secondary",
  },
} as const;

/** Displays a private submission with safe business navigation and shared media. */
function MyReviewCard({
  review,
  onActions,
}: {
  review: MyReview;
  onActions?: () => void;
}) {
  const { business } = review;
  const isAvailable = business.status === "active";
  const status = statusPresentation[review.status];
  const openBusiness = () => {
    if (!isAvailable) return;
    router.push({
      pathname: "/(explorer)/business/[businessId]",
      params: { businessId: String(business.id) },
    });
  };

  return (
    <View
      testID={`my-review-${review.id}`}
      className="rounded-card bg-surface p-4"
    >
      {/* Business identity and availability */}
      <View className="flex-row items-start">
        <SafePressable
          onPress={openBusiness}
          disabled={!isAvailable}
          accessibilityRole="button"
          accessibilityLabel={`Open ${business.business_name} business profile`}
          accessibilityState={{ disabled: !isAvailable }}
          className="min-h-12 flex-1 cursor-pointer flex-row items-center active:opacity-70"
        >
          <View className="h-12 w-12 overflow-hidden rounded-lg bg-background">
            {business.display_cover_photo_url ? (
              <Image
                source={{ uri: business.display_cover_photo_url }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                recyclingKey={String(business.id)}
              />
            ) : (
              <View className="flex-1 items-center justify-center">
                <MaterialCommunityIcons
                  name="storefront-outline"
                  size={24}
                  color={theme.extends.colors.text.secondary}
                />
              </View>
            )}
          </View>
          <View className="ml-3 min-w-0 flex-1">
            <AppText
              weight="bold"
              className="text-sm text-text-primary"
              numberOfLines={2}
            >
              {business.business_name}
            </AppText>
            <AppText
              className="mt-0.5 text-xs text-text-secondary"
              numberOfLines={2}
            >
              {business.category.name}
            </AppText>
            {!isAvailable && (
              <AppText className="mt-1 text-xs text-text-secondary">
                Business unavailable
              </AppText>
            )}
          </View>
          {isAvailable && (
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={theme.extends.colors.text.secondary}
            />
          )}
        </SafePressable>
        {onActions && (
          <Pressable
            onPress={onActions}
            accessibilityRole="button"
            accessibilityLabel={`Review actions for ${business.business_name}`}
            className="ml-1 min-h-12 min-w-11 cursor-pointer items-center justify-center rounded-full active:bg-surface-muted"
          >
            <MaterialCommunityIcons
              name="dots-horizontal"
              size={20}
              color={theme.extends.colors.text.secondary}
            />
          </Pressable>
        )}
      </View>

      {/* Submission date and publication state */}
      <View className="mt-4 flex-row flex-wrap items-center gap-2">
        <AppText className="text-xs text-text-secondary">
          {new Date(review.created_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
          {review.edited_at ? " · Edited" : ""}
        </AppText>
        <AppText
          weight="semibold"
          className={`overflow-hidden rounded-full px-2.5 py-1 text-xs ${status.className}`}
        >
          {status.label}
        </AppText>
      </View>

      {/* Shared review text, photos, and merchant response */}
      <ReviewContent
        review={review}
        showAuthor={false}
        showEngagement={false}
        showSpecialtyVouches={false}
      />
      {review.reply && <MerchantReviewResponse reply={review.reply} />}
    </View>
  );
}

export default memo(MyReviewCard);
