import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import Skeleton from "@/shared/components/Skeleton";

type Props = {
  message: string;
};

/**
 * Keeps the Getting There route-list structure visible while guidance loads.
 *
 * Mirrors the collapsed journey-card layout so the loading state transitions
 * naturally into the initial route options without a large layout shift.
 */
export default function GettingThereLoadingState({ message }: Props) {
  return (
    <View accessibilityLabel={message} accessibilityRole="progressbar">
      {/* Loading context */}
      <AppText className="mb-4 text-sm text-text-secondary">{message}</AppText>

      {/* Route options heading */}
      <View className="mb-4 flex-row items-end justify-between">
        <View>
          <Skeleton className="h-4 w-24 rounded-full" />
          <Skeleton className="mt-2 h-3 w-44 rounded-full" />
        </View>

        <Skeleton className="h-6 w-16 rounded-full" />
      </View>

      {/* Collapsed route placeholders */}
      <View className="gap-3">
        {[0, 1, 2].map((index) => (
          <View
            key={index}
            className="relative min-h-20 flex-row items-center rounded-card border border-border-primary bg-surface px-4 py-4"
          >
            {/* Route identifier */}
            <Skeleton className="h-10 w-16 shrink-0 rounded-lg" />

            {/* Route summary */}
            <View className="ml-3 min-w-0 flex-1">
              <Skeleton
                className={`h-4 rounded-full ${
                  index === 0 ? "w-4/5" : "w-3/4"
                }`}
              />

              <Skeleton className="mt-2 h-3 w-28 rounded-full" />
            </View>

            {/* Expand control */}
            <Skeleton className="ml-3 h-6 w-6 shrink-0 rounded-full" />
          </View>
        ))}
      </View>
    </View>
  );
}
