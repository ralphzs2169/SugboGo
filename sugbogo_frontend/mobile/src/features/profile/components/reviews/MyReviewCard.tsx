import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { memo } from "react";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import MerchantReviewResponse from "@/features/explore/components/business-profile/reviews/MerchantReviewResponse";
import ReviewContent from "@/features/explore/components/business-profile/reviews/ReviewContent";
import AuthorReviewStatus from "@/features/explore/components/business-profile/reviews/AuthorReviewStatus";
import { useAuthorReviewSource } from "@/features/explore/hooks/useAuthorReviewSource";
import { useReviewWorkflowStore } from "@/features/explore/stores/reviewWorkflow.store";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";

import type { MyReview } from "../../types/myReview.types";

/**
 * Displays a private review in a full-width, separator-based list.
 *
 * Keeps business navigation separate from review management actions,
 * with the date beneath the business identity and actions at the bottom right.
 */
function MyReviewCard({
  review: suppliedReview,
  onActions,
}: {
  review: MyReview;
  onActions?: (review: MyReview) => void;
}) {
  const review = useAuthorReviewSource(
    suppliedReview.business.id,
    suppliedReview,
  );
  const saving = useReviewWorkflowStore((state) =>
    Boolean(state.edits[review.id]),
  );
  const { business } = review;
  const isAvailable = business.status === "active";

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
      <View className="flex-row items-start gap-1">
        <SafePressable
          onPress={openBusiness}
          disabled={!isAvailable}
          accessibilityRole="button"
          accessibilityLabel={`Open ${business.business_name} business profile`}
          accessibilityState={{ disabled: !isAvailable }}
          className={`min-h-14 flex-1 flex-row items-center rounded-lg pr-1 ${
            isAvailable
              ? "cursor-pointer active:bg-surface-muted"
              : "opacity-70"
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
            <AppText className="mt-1 text-xs text-text-tertiary">
              {new Date(review.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              {review.edited_at ? " · Edited" : ""}
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

      </View>

      {/* Review content and attached photos */}
      {saving && (
        <AppText
          accessibilityLiveRegion="polite"
          className="mt-2 text-xs text-text-secondary"
        >
          Saving changes…
        </AppText>
      )}
      <View>
        <ReviewContent
          review={review}
          showAuthor={false}
          showEngagement={false}
          showSpecialtyVouches={false}
        />
      </View>

      {review.is_own_review && <AuthorReviewStatus review={review} />}

      {/* Merchant response */}
      {review.reply && <MerchantReviewResponse reply={review.reply} />}

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
    </View>
  );
}

export default memo(MyReviewCard);
