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
import { getSpecialtyTagColor } from "@/shared/constants/specialtyTagColors";

import type { MyReview } from "../../types/myReview.types";

type StatusPresentation = {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  pillClassName: string;
  textClassName: string;
  iconColor: string;
};

const mutedStatus = {
  pillClassName: "bg-surface-muted",
  textClassName: "text-text-secondary",
  iconColor: theme.extends.colors.text.secondary,
} as const;

const statusPresentation: Record<MyReview["status"], StatusPresentation> = {
  published: {
    label: "Published",
    icon: "check-circle-outline",
    pillClassName: getSpecialtyTagColor("green").softBackground,
    textClassName: getSpecialtyTagColor("green").softText,
    iconColor: getSpecialtyTagColor("green").softIcon,
  },
  under_review: {
    label: "Under review",
    icon: "clock-outline",
    pillClassName: "bg-info",
    textClassName: "text-text-info",
    iconColor: theme.extends.colors.text.info,
  },
  rejected: {
    label: "Not published",
    icon: "eye-off-outline",
    ...mutedStatus,
  },
  flagged: {
    label: "Not published",
    icon: "eye-off-outline",
    ...mutedStatus,
  },
};

/**
 * Displays a private review in a full-width, separator-based list.
 *
 * Keeps business navigation separate from review management actions,
 * with the action menu below the author's content and before any
 * merchant response.
 */
function MyReviewCard({
  review,
  onActions,
}: {
  review: MyReview;
  onActions?: (review: MyReview) => void;
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
    <View testID={`my-review-${review.id}`} className="bg-surface px-4 py-4">
      {/* Business identity and navigation */}
      <SafePressable
        onPress={openBusiness}
        disabled={!isAvailable}
        accessibilityRole="button"
        accessibilityLabel={`Open ${business.business_name} business profile`}
        accessibilityState={{ disabled: !isAvailable }}
        className={`min-h-14 flex-row items-center rounded-lg pr-1 ${
          isAvailable ? "cursor-pointer active:bg-surface-muted" : "opacity-70"
        }`}
      >
        <View className="h-12 w-12 overflow-hidden rounded-lg bg-surface-muted">
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
            numberOfLines={1}
          >
            {business.business_name}
          </AppText>

          <AppText
            className="mt-0.5 text-xs text-text-secondary"
            numberOfLines={1}
          >
            {isAvailable
              ? business.category.name
              : `${business.category.name} · Unavailable`}
          </AppText>
        </View>

        {isAvailable && (
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={theme.extends.colors.text.secondary}
          />
        )}
      </SafePressable>

      {/* Publication status and submission date */}
      <View className="mt-3 flex-row flex-wrap items-center justify-between gap-2">
        <View
          className={`flex-row items-center rounded-full px-2.5 py-1 ${status.pillClassName}`}
        >
          <MaterialCommunityIcons
            name={status.icon}
            size={14}
            color={status.iconColor}
          />

          <AppText
            weight="semibold"
            className={`ml-1 text-xs ${status.textClassName}`}
          >
            {status.label}
          </AppText>
        </View>

        <AppText className="text-xs text-text-secondary">
          {new Date(review.created_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
          {review.edited_at ? " · Edited" : ""}
        </AppText>
      </View>

      {/* Review content and attached photos */}
      <View className="mt-2">
        <ReviewContent
          review={review}
          showAuthor={false}
          showEngagement={false}
          showSpecialtyVouches={false}
        />
      </View>

      {/* Review management actions */}
      {onActions && (
        <View className="mt-1 flex-row justify-end">
          <Pressable
            onPress={() => onActions(review)}
            accessibilityRole="button"
            accessibilityLabel={`Review actions for ${business.business_name}`}
            className="h-11 w-11 cursor-pointer items-center justify-center rounded-full active:bg-surface-muted"
          >
            <MaterialCommunityIcons
              name="dots-horizontal"
              size={22}
              color={theme.extends.colors.text.secondary}
            />
          </Pressable>
        </View>
      )}

      {/* Merchant response */}
      {review.reply && <MerchantReviewResponse reply={review.reply} />}
    </View>
  );
}

export default memo(MyReviewCard);
