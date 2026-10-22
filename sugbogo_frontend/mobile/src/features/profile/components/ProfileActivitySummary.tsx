import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";

import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import usePocketCollections from "@/features/pockets/hooks/usePocketCollections";

import { useMyReviews } from "../hooks/useMyReviews";
import useVouchHistory from "../hooks/useVouchHistory";

/** Displays non-interactive account activity totals without inventing missing counts. */
export default function ProfileActivitySummary({
  className = "mx-4 my-2",
}: {
  className?: string;
}) {
  const reviews = useMyReviews();
  const pockets = usePocketCollections();
  const vouches = useVouchHistory("newest");
  const hasError = Boolean(pockets.error || reviews.error || vouches.error);
  const metrics = [
    {
      label: "Pockets",
      icon: "bookmark-outline" as const,
      value: pockets.hasData ? pockets.totalCount : null,
      loading: pockets.isLoading || pockets.isAuthLoading,
    },
    {
      label: "Vouches",
      icon: "heart-outline" as const,
      value: vouches.summary?.total_specialty_vouches ?? null,
      loading: vouches.isLoading,
    },
    {
      label: "Reviews",
      icon: "comment-text-outline" as const,
      value: reviews.data ? reviews.totalCount : null,
      loading: reviews.isLoading,
    },
  ];

  return (
    <View className={`rounded-card bg-surface ${className}`}>
      {/* Account activity totals */}
      <View className="flex-row items-center px-2">
        {metrics.map((metric, index) => (
          <View
            key={metric.label}
            className="min-w-0 flex-1 flex-row items-center"
          >
            {index > 0 && <View className="h-6 w-px bg-border-primary/60" />}
            <View
              accessible
              accessibilityLabel={`${metric.label}: ${
                metric.loading
                  ? "loading"
                  : (metric.value ?? "count unavailable")
              }`}
              accessibilityState={{ busy: metric.loading }}
              className="my-1 min-h-14 min-w-0 flex-1 items-center justify-center px-1 py-1"
            >
              <AppText weight="bold" className="text-xl text-text-primary">
                {metric.loading ? "…" : (metric.value?.toLocaleString() ?? "—")}
              </AppText>
              <View className="mt-1 flex-row items-center justify-center gap-1">
                <MaterialCommunityIcons
                  name={metric.icon}
                  size={14}
                  color={theme.extends.colors.text.secondary}
                  accessible={false}
                />
                <AppText className="text-center text-xs text-text-secondary">
                  {metric.label}
                </AppText>
              </View>
            </View>
          </View>
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
            if (pockets.error) {
              void pockets.refetch();
            }
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
