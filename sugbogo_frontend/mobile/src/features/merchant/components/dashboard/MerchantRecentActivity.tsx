import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import SafePressable from "@/shared/components/SafePressable";
import Skeleton from "@/shared/components/Skeleton";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";

import MerchantContentSection from "../../layout/MerchantContentSection";
import type { MerchantBusinessSpecialty } from "../../types/merchantBusinessProfile.types";
import type {
  MerchantRecentActivity as ActivitySnapshot,
  MerchantRecentActivityItem,
  MerchantRecentActivityType,
} from "../../types/merchantRecentActivity.types";
import {
  formatRecentActivityTime,
  recentActivityReviewId,
} from "../../utils/merchantRecentActivity.utils";

const ACTIVITY_META: Record<
  MerchantRecentActivityType,
  {
    label: string;
    icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
    color: string;
  }
> = {
  review: {
    label: "New review",
    icon: "message-text-outline",
    color: theme.extends.colors.text.secondary,
  },
  vouch: {
    label: "Specialty vouch",
    icon: "heart-outline",
    color: "#DC2626",
  },
  save: {
    label: "Pocket save",
    icon: "bookmark-outline",
    color: theme.extends.colors.text.secondary,
  },
};

/** Sizes each activity from its content, including wrapped specialty chips. */
function ActivityRow({
  item,
  onReview,
  specialtyTags,
}: {
  item: MerchantRecentActivityItem;
  onReview: (reviewId: number) => void;
  specialtyTags: MerchantBusinessSpecialty[];
}) {
  const reviewId = recentActivityReviewId(item);
  const time = formatRecentActivityTime(item);
  const meta = ACTIVITY_META[item.type];

  const isReview = reviewId !== null;

  const showSpecialties = item.type === "vouch" && item.specialties.length > 0;

  const specialtyNames = showSpecialties
    ? item.specialties.map((specialty) => specialty.name).join(", ")
    : "";

  const accessibilityLabel = [
    meta.label,
    item.title,
    item.description,
    specialtyNames,
    item.remaining_specialties > 0
      ? `${item.remaining_specialties} more specialties`
      : "",
    time,
  ]
    .filter(Boolean)
    .join(". ");

  const content = (
    <View className="w-full min-w-0 shrink-0 flex-row items-start gap-3 py-4">
      {/* Activity icon */}
      <View
        className="w-6 shrink-0 items-center pt-0.5"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <MaterialCommunityIcons name={meta.icon} size={21} color={meta.color} />
      </View>

      {/* Activity details */}
      <View className="min-w-0 flex-1 gap-1.5">
        <AppText
          weight="medium"
          className="text-sm leading-5 text-text-primary"
        >
          {item.title}
        </AppText>

        {showSpecialties ? (
          <View className="mt-0.5 flex-row flex-wrap">
            {item.specialties.map((specialty) => {
              const profileTag = specialtyTags.find(
                (tag) => tag.id === specialty.id,
              );

              return (
                <View key={specialty.id} className="max-w-full">
                  <SpecialtyTagChip
                    tag={{
                      name: specialty.name,
                      color: profileTag?.color ?? "blue",
                      icon: profileTag?.icon,
                    }}
                    size="small"
                    showIcon
                  />
                </View>
              );
            })}

            {item.remaining_specialties > 0 && (
              <View className="mb-2 justify-center py-1">
                <AppText className="text-xs text-text-secondary">
                  +{item.remaining_specialties} more
                </AppText>
              </View>
            )}
          </View>
        ) : item.type === "review" && !!item.description ? (
          <AppText
            numberOfLines={2}
            className="text-sm leading-5 text-text-secondary"
          >
            “{item.description}”
          </AppText>
        ) : !!item.description ? (
          <AppText className="text-sm leading-5 text-text-secondary">
            {item.description}
          </AppText>
        ) : null}
      </View>

      {/* Consistently aligned timestamp and chevron */}
      <View className="w-24 shrink-0 flex-row items-start justify-end gap-1 pt-0.5">
        {!!time && (
          <AppText
            numberOfLines={1}
            className="min-w-0 flex-1 text-right text-xs leading-5 text-text-secondary"
          >
            {time}
          </AppText>
        )}

        <View
          className="h-5 w-4 items-center justify-center"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {isReview && (
            <MaterialCommunityIcons
              name="chevron-right"
              size={18}
              color={theme.extends.colors.text.tertiary}
            />
          )}
        </View>
      </View>
    </View>
  );

  return (
    <View className="shrink-0 self-stretch border-b border-border-primary">
      {isReview ? (
        <SafePressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint="Opens this review in Merchant Reviews"
          onPress={() => onReview(reviewId)}
          className="min-h-12 shrink-0 self-stretch rounded-lg active:bg-surface-muted"
        >
          {content}
        </SafePressable>
      ) : (
        <View
          accessible
          accessibilityLabel={accessibilityLabel}
          className="shrink-0 self-stretch"
        >
          {content}
        </View>
      )}
    </View>
  );
}

// Loading state

function ActivitySkeleton() {
  return (
    <View
      accessibilityLabel="Loading recent activity"
      accessibilityState={{ busy: true }}
      className="gap-5"
    >
      {[0, 1, 2].map((index) => (
        <View key={index} className="flex-row items-start gap-3">
          <Skeleton className="h-5 w-5 rounded" />

          <View className="flex-1 gap-2">
            <Skeleton className="h-4 w-4/5 rounded" />
            <Skeleton className="h-3 w-3/5 rounded" />
          </View>

          <Skeleton className="h-3 w-14 rounded" />
        </View>
      ))}
    </View>
  );
}

// Empty state

function ActivityEmptyState() {
  return (
    <View className="items-center rounded-card bg-surface-muted px-5 py-8">
      <MaterialCommunityIcons
        name="history"
        size={28}
        color={theme.extends.colors.text.secondary}
        accessible={false}
      />

      <AppText
        weight="semibold"
        className="mt-3 text-center text-sm text-text-primary"
      >
        No recent activity yet
      </AppText>

      <AppText className="mt-1 text-center text-sm leading-5 text-text-secondary">
        New reviews, specialty vouches, and Pocket saves will appear here.
      </AppText>
    </View>
  );
}

// Recent activity section

export default function MerchantRecentActivity({
  data,
  loading,
  refreshing,
  error,
  onRetry,
  onReview,
  specialtyTags = [],
}: {
  data?: ActivitySnapshot;
  loading: boolean;
  refreshing: boolean;
  error: unknown;
  onRetry: () => void;
  onReview: (reviewId: number) => void;
  specialtyTags?: MerchantBusinessSpecialty[];
}) {
  const savesUnavailable = data?.sources.saves.availability === "unavailable";

  const partial = !!data && (data.is_partial || savesUnavailable);

  const partialTitle = savesUnavailable
    ? "Save activity is temporarily unavailable"
    : "Some activity is temporarily unavailable";

  const items = data?.items ?? [];

  const showLoading = loading && !data && !error;

  const showEmpty = !!data && items.length === 0 && !partial && !error;

  const showPartial = !!data && partial && !error;

  return (
    <MerchantContentSection
      title="Recent activity"
      icon="history"
      description="What explorers are sharing and saving."
    >
      {showLoading && <ActivitySkeleton />}

      {!!error && (
        <View className="-mx-4 mb-3">
          <ErrorState
            size="section"
            title={data ? "Couldn't refresh activity" : "Activity unavailable"}
            description={
              data
                ? "Previously loaded updates are still shown."
                : "Your recent activity couldn't be loaded. Please try again."
            }
            primaryActionTitle="Retry"
            onPrimaryAction={onRetry}
          />
        </View>
      )}

      {items.map((item) => (
        <ActivityRow
          key={`${item.type}-${item.id}`}
          item={item}
          onReview={onReview}
          specialtyTags={specialtyTags}
        />
      ))}

      {showEmpty && <ActivityEmptyState />}

      {showPartial && (
        <View
          className={`flex-row items-start gap-2.5 rounded-card bg-info p-3 ${
            items.length > 0 ? "mt-4" : ""
          }`}
        >
          <MaterialCommunityIcons
            name="information-outline"
            size={18}
            color={theme.extends.colors.text.info}
            accessible={false}
          />

          <View className="min-w-0 flex-1">
            <AppText
              weight="semibold"
              className="text-sm leading-5 text-text-primary"
            >
              {partialTitle}
            </AppText>

            <AppText className="mt-1 text-sm leading-5 text-text-secondary">
              {items.length
                ? "Your other recent updates are still shown."
                : savesUnavailable
                  ? "Reviews and vouches will appear here when available."
                  : "Recent updates will appear here when available."}
            </AppText>

            <SafePressable
              accessibilityRole="button"
              accessibilityLabel="Retry recent activity"
              accessibilityState={{
                disabled: refreshing,
                busy: refreshing,
              }}
              disabled={refreshing}
              onPress={onRetry}
              className="mt-1 min-h-11 justify-center self-start px-1 active:opacity-70"
            >
              <AppText weight="semibold" className="text-sm text-text-info">
                {refreshing ? "Refreshing…" : "Try again"}
              </AppText>
            </SafePressable>
          </View>
        </View>
      )}
    </MerchantContentSection>
  );
}
