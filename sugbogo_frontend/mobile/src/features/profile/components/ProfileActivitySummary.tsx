import { router } from "expo-router";
import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import SafePressable from "@/shared/components/SafePressable";

import { useMyReviews } from "../hooks/useMyReviews";
import useVouchHistory from "../hooks/useVouchHistory";

/** Displays account activity totals and shortcuts without inventing missing counts. */
export default function ProfileActivitySummary() {
  const reviews = useMyReviews();
  const vouches = useVouchHistory("newest");
  const hasError = Boolean(reviews.error || vouches.error);
  const metrics = [
    {
      label: "Pockets",
      value: null,
      loading: false,
      route: "/profile/my-pockets" as const,
    },
    {
      label: "Vouches",
      value: vouches.summary?.total_specialty_vouches ?? null,
      loading: vouches.isLoading,
      route: "/profile/vouch-history" as const,
    },
    {
      label: "Reviews",
      value: reviews.data ? reviews.totalCount : null,
      loading: reviews.isLoading,
      route: "/profile/reviews-submitted" as const,
    },
  ];

  return (
    <View className="mt-1.5 rounded-md bg-surface py-4">
      {/* Activity shortcuts */}
      <AppText
        weight="semibold"
        className="mb-3 px-5 text-sm text-text-secondary"
      >
        Your Activity
      </AppText>
      <View className="flex-row px-2">
        {metrics.map((metric) => (
          <SafePressable
            key={metric.label}
            accessibilityRole="button"
            accessibilityLabel={`${metric.label}: ${
              metric.loading ? "loading" : (metric.value ?? "count unavailable")
            }`}
            accessibilityHint={`Open My ${metric.label}`}
            accessibilityState={{ busy: metric.loading }}
            onPress={() => router.push(metric.route)}
            className="min-h-20 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-md px-1 py-2 active:bg-background"
          >
            <AppText weight="bold" className="text-2xl text-text-primary">
              {metric.loading ? "…" : (metric.value?.toLocaleString() ?? "—")}
            </AppText>
            <AppText className="mt-1 text-center text-xs text-text-secondary">
              {metric.label}
            </AppText>
          </SafePressable>
        ))}
      </View>

      {/* Recover failed totals without blocking navigation. */}
      {hasError && (
        <ErrorState
          size="section"
          title="Some activity totals are unavailable"
          description="You can still open your activity."
          primaryActionTitle="Try Again"
          onPrimaryAction={() => {
            if (reviews.error) {
              void reviews.refetch();
            }
            if (vouches.error) {
              void vouches.refetch();
            }
          }}
        />
      )}
    </View>
  );
}
