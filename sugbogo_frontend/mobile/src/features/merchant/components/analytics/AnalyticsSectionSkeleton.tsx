import { View } from "react-native";

import Skeleton from "@/shared/components/Skeleton";

type Props = {
  section: "activity" | "snapshot" | "specialties";
};

/** Reserves each analytics section while leaving navigation and filters mounted. */
export default function AnalyticsSectionSkeleton({ section }: Props) {
  return (
    <View
      accessibilityLabel={`Loading ${section}`}
      accessibilityState={{ busy: true }}
      className={section === "activity" ? "flex-row flex-wrap gap-3" : "gap-3"}
    >
      {/* Section-shaped loading placeholders */}
      {Array.from({ length: section === "activity" ? 4 : 2 }, (_, index) => (
        <View
          key={index}
          className={
            section === "activity"
              ? "min-w-32 flex-1 basis-1/3 gap-3 rounded-card border border-border-primary bg-surface p-4"
              : "gap-3 rounded-card border border-border-primary bg-surface p-4"
          }
        >
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-8 w-16 rounded" />
          <Skeleton className="h-3 w-28 rounded" />
        </View>
      ))}
    </View>
  );
}
