import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import DottedTimelineConnector from "@/shared/components/DottedTimelineConnector";
import SafePressable from "@/shared/components/SafePressable";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import { getSpecialtyTagColor } from "@/shared/constants/specialtyTagColors";

import type { TimelineActivity } from "../../types/activityTimeline.types";

const ACTIONS = {
  save: {
    verb: "Saved",
    label: "Saved to Pockets",
    icon: "bookmark-outline",
    background: "bg-info",
    color: theme.extends.colors.text.info,
  },
  vouch: {
    verb: "Vouched for",
    label: "Specialty vouch",
    icon: "heart-outline",
    background: getSpecialtyTagColor("red").softBackground,
    color: getSpecialtyTagColor("red").softIcon,
  },
  review: {
    verb: "Reviewed",
    label: "Review submitted",
    icon: "comment-text-outline",
    background: "bg-surface-muted",
    color: theme.extends.colors.text.secondary,
  },
} as const;

const REVIEW_STATUSES = {
  published: "Published",
  under_review: "Under review",
  flagged: "Not published",
  rejected: "Not published",
};

type Props = {
  activity: TimelineActivity;
  isFirst: boolean;
  continues: boolean;
  onPress: () => void;
};

/** Presents a restrained timeline row with contribution context and availability. */
export default function ActivityTimelineItem({
  activity,
  isFirst,
  continues,
  onPress,
}: Props) {
  const action = ACTIONS[activity.type];
  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null);
  const coverUrl = activity.business.display_cover_photo_url;
  const unavailable = activity.business.status !== "active";
  const disabled = unavailable && activity.type !== "review";
  const time = new Date(activity.occurred_at).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  const reviewStatus =
    activity.type === "review" ? activity.review.status : null;
  const isUnderReview = reviewStatus === "under_review";
  const announcement = [`${action.verb} ${activity.business.business_name}`];
  if (activity.type === "vouch") {
    announcement.push(activity.specialty.name);
  }
  if (activity.type === "review") {
    announcement.push(activity.review.excerpt);
    announcement.push(REVIEW_STATUSES[activity.review.status]);
    if (activity.review.edited_at) {
      announcement.push("Edited");
    }
  }
  if (unavailable) {
    announcement.push("Business unavailable");
  }
  announcement.push(time);

  return (
    <View className="flex-row gap-3 px-4">
      {/* Shared timeline rail follows the height of each entry. */}
      <View className="w-8 items-center self-stretch pt-3">
        <View
          className={`h-8 w-8 items-center justify-center rounded-full ${action.background}`}
        >
          <MaterialCommunityIcons
            name={action.icon}
            size={17}
            color={action.color}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </View>
        {continues && <DottedTimelineConnector className="my-1 flex-1" />}
      </View>

      {/* The business is the visual anchor; action and time are supporting metadata. */}
      <SafePressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={announcement.join(". ")}
        accessibilityState={{ disabled }}
        accessibilityHint={
          activity.type === "review" ? "Open My Reviews" : "Open business"
        }
        className={`min-h-20 min-w-0 flex-1 cursor-pointer bg-surface px-0 py-5 active:bg-surface-muted ${
          isFirst ? "" : "border-t border-border-primary"
        }`}
      >
        {/* Compact activity metadata */}
        <View className="flex-row flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <AppText weight="semibold" className="text-xs text-text-secondary">
            {action.label}
          </AppText>
          <AppText className="text-xs text-text-secondary">{time}</AppText>
        </View>
        <View className="mt-2 flex-row items-center gap-2">
          {/* Business cover follows the existing profile thumbnail treatment. */}
          <View className="h-12 w-12 overflow-hidden rounded-lg bg-surface-muted">
            {coverUrl && failedCoverUrl !== coverUrl ? (
              <Image
                source={{ uri: coverUrl }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                recyclingKey={String(activity.business.id)}
                onError={() => setFailedCoverUrl(coverUrl)}
                accessible={false}
              />
            ) : (
              <View className="flex-1 items-center justify-center">
                <MaterialCommunityIcons
                  name="storefront-outline"
                  size={22}
                  color={theme.extends.colors.text.secondary}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
              </View>
            )}
          </View>
          <AppText
            weight="bold"
            className="min-w-0 flex-1 text-base leading-6 text-text-primary"
          >
            {activity.business.business_name}
          </AppText>
          {!disabled && (
            <MaterialCommunityIcons
              name="chevron-right"
              size={18}
              color={theme.extends.colors.text.secondary}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          )}
        </View>

        {/* Contribution details retain the existing profile status language. */}
        {activity.type === "vouch" && (
          <View className="mt-3 flex-row flex-wrap">
            <SpecialtyTagChip
              tag={activity.specialty}
              mode="display"
              size="small"
              showIcon
            />
          </View>
        )}
        {activity.type === "review" && (
          <>
            <AppText
              className="mt-1.5 text-sm leading-5 text-text-secondary"
              numberOfLines={2}
            >
              {activity.review.excerpt}
            </AppText>
            <View className="mt-3 flex-row flex-wrap items-center gap-2">
              <View
                className={`flex-row items-center gap-1 rounded-full px-2.5 py-1 ${
                  isUnderReview ? "bg-info" : "bg-surface-muted"
                }`}
              >
                <MaterialCommunityIcons
                  name={
                    isUnderReview
                      ? "clock-outline"
                      : reviewStatus === "published"
                        ? "check-circle-outline"
                        : "eye-off-outline"
                  }
                  size={13}
                  color={
                    isUnderReview
                      ? theme.extends.colors.text.info
                      : theme.extends.colors.text.secondary
                  }
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
                <AppText
                  weight="medium"
                  className={`text-xs ${
                    isUnderReview ? "text-text-info" : "text-text-secondary"
                  }`}
                >
                  {REVIEW_STATUSES[activity.review.status]}
                </AppText>
              </View>
              {activity.review.edited_at && (
                <AppText className="text-xs text-text-secondary">
                  Edited
                </AppText>
              )}
            </View>
          </>
        )}
        {unavailable && (
          <AppText className="mt-2 text-xs text-text-secondary">
            Business unavailable
          </AppText>
        )}
      </SafePressable>
    </View>
  );
}
