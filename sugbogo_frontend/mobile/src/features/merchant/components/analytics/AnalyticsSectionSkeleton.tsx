import { View } from "react-native";

import { AnalyticsActivitySkeleton } from "./AnalyticsActivityOverview";
import { AnalyticsRowsSkeleton } from "./AnalyticsLoadingSkeletons";
import Skeleton from "@/shared/components/Skeleton";

type Props = {
  section: "activity" | "snapshot" | "specialties";
};

/** Reserves each analytics section while leaving navigation and filters mounted. */
export default function AnalyticsSectionSkeleton({ section }: Props) {
  if (section === "activity") return <AnalyticsActivitySkeleton />;
  if (section === "specialties") return <AnalyticsRowsSkeleton bars />;
  return (
    <View
      accessibilityLabel={`Loading ${section}`}
      accessibilityState={{ busy: true }}
      className="gap-3"
    >
      {[0, 1].map((index) => (
        <View key={index} className="gap-3 rounded-card bg-surface-muted p-4">
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-8 w-16 rounded" />
          <Skeleton className="h-3 w-28 rounded" />
        </View>
      ))}
    </View>
  );
}
