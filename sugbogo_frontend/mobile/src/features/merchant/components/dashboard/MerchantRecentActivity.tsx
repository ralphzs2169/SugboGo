import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import DottedTimelineConnector from "@/shared/components/DottedTimelineConnector";
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
    icon: ComponentProps<typeof MaterialCommunityIcons>["name"];
    color: string;
    background: string;
  }
> = {
  review: {
    icon: "message-text-outline",
    color: theme.extends.colors.brand,
    background: "bg-brand/10",
  },
  vouch: {
    icon: "thumb-up-outline",
    color: theme.extends.colors.border.success,
    background: "bg-success/10",
  },
  save: {
    icon: "bookmark-outline",
    color: theme.extends.colors.text.info,
    background: "bg-info",
  },
};

/** Shows one explorer update along the shared merchant timeline, with review-only navigation. */
function ActivityRow({
  item,
  last,
  onReview,
  specialtyTags,
}: {
  item: MerchantRecentActivityItem;
  last: boolean;
  onReview: (reviewId: number) => void;
  specialtyTags: MerchantBusinessSpecialty[];
}) {
  const reviewId = recentActivityReviewId(item);
  const time = formatRecentActivityTime(item);
  const meta = ACTIVITY_META[item.type];
  const showSpecialties = item.type === "vouch" && item.specialties.length > 0;
  const rowClass = `min-h-12 min-w-0 flex-1 flex-row items-start gap-2 px-1 pt-0.5 ${last ? "pb-1" : "pb-6"}`;
  const content = (
    <>
      <View className="min-w-0 flex-1 gap-1">
        <AppText
          weight="semibold"
          className="text-sm leading-5 text-text-primary"
        >
          {item.title}
        </AppText>
        {showSpecialties ? (
          <View className="-mb-2 mt-1 flex-row flex-wrap">
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
              <AppText className="mb-2 py-1 text-xs text-text-secondary">
                +{item.remaining_specialties} more
              </AppText>
            )}
          </View>
        ) : !!item.description ? (
          <AppText
            numberOfLines={item.type === "review" ? 2 : undefined}
            className="text-sm leading-5 text-text-secondary"
          >
            {item.type === "review"
              ? `“${item.description}”`
              : item.description}
          </AppText>
        ) : null}
        {!!time && (
          <AppText className="mt-1 text-xs text-text-secondary">{time}</AppText>
        )}
      </View>
      {reviewId !== null && (
        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color={theme.extends.colors.text.secondary}
          accessible={false}
        />
      )}
    </>
  );
  const label = [item.title, item.description, time].filter(Boolean).join(". ");

  return (
    <View className="flex-row gap-3">
      {/* Quiet category markers and shared connectors keep the section scannable. */}
      <View className="w-10 items-center">
        <View
          className={`h-10 w-10 items-center justify-center rounded-full ${meta.background}`}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <MaterialCommunityIcons
            name={meta.icon}
            size={20}
            color={meta.color}
          />
        </View>
        {!last && (
          <View
            className="my-2 min-h-4 flex-1"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <DottedTimelineConnector className="flex-1" />
          </View>
        )}
      </View>
      {reviewId !== null ? (
        <SafePressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint="Opens this review in Merchant Reviews"
          onPress={() => onReview(reviewId)}
          className={`${rowClass} cursor-pointer rounded-lg active:bg-surface-muted`}
        >
          {content}
        </SafePressable>
      ) : (
        <View accessible accessibilityLabel={label} className={rowClass}>
          {content}
        </View>
      )}
    </View>
  );
}

/** Presents the latest business updates with independent recovery and truthful tracking states. */
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

  return (
    <MerchantContentSection
      title="Recent activity"
      description="What explorers are sharing and saving."
    >
      {loading && !data && !error && (
        <View
          accessibilityLabel="Loading recent activity"
          accessibilityState={{ busy: true }}
          className="gap-5"
        >
          {[0, 1, 2].map((index) => (
            <View key={index} className="flex-row gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <View className="flex-1 gap-2 pt-1">
                <Skeleton className="h-4 w-4/5 rounded" />
                <Skeleton className="h-4 w-3/5 rounded" />
                <Skeleton className="h-3 w-16 rounded" />
              </View>
            </View>
          ))}
        </View>
      )}

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

      {items.map((item, index) => (
        <ActivityRow
          key={item.id}
          item={item}
          last={index === items.length - 1}
          onReview={onReview}
          specialtyTags={specialtyTags}
        />
      ))}

      {data && items.length === 0 && !partial && !error && (
        <View className="items-center rounded-card bg-surface-muted px-5 py-6">
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
      )}

      {data && partial && (
        <View
          className={`flex-row items-start gap-2.5 rounded-card bg-info p-3 ${items.length ? "mt-4" : ""}`}
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
              accessibilityState={{ disabled: refreshing, busy: refreshing }}
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
