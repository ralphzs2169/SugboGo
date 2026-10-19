import { View } from "react-native";

import Skeleton from "@/shared/components/Skeleton";

/** Matches collection card structure while the authenticated overview loads. */
export default function PocketCollectionsSkeleton() {
  return (
    <View
      testID="pocket-collections-skeleton"
      accessibilityLabel="Loading your Pockets"
      accessibilityState={{ busy: true }}
    >
      {/* Collection placeholders */}
      <View
        className="gap-3"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {[0, 1, 2].map((index) => (
          <View
            key={index}
            className="flex-row items-start gap-3 rounded-card border border-border-primary bg-surface p-4"
          >
            <Skeleton className="h-10 w-10 rounded-card" />
            <View className="flex-1 gap-2">
              <Skeleton className="h-4 w-3/4 rounded" />
              <Skeleton className="h-3 w-1/2 rounded" />
              {index === 0 && (
                <Skeleton className="mt-1 h-5 w-16 rounded-full" />
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
