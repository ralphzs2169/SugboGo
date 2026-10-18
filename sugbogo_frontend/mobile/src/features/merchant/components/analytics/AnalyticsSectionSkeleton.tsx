import { View, useWindowDimensions } from "react-native";

import Skeleton from "@/shared/components/Skeleton";

type Props = {
  section: "activity" | "snapshot" | "specialties";
};

/** Reserves each analytics section while leaving navigation and filters mounted. */
export default function AnalyticsSectionSkeleton({ section }: Props) {
  const { width, fontScale } = useWindowDimensions();
  const singleColumn = width < 340 || fontScale >= 1.5;
  const isActivity = section === "activity";
  return (
    <View
      accessibilityLabel={`Loading ${section}`}
      accessibilityState={{ busy: true }}
      className={
        isActivity && !singleColumn ? "flex-row flex-wrap gap-3" : "gap-3"
      }
    >
      {/* Section-shaped loading placeholders */}
      {Array.from({ length: isActivity ? 5 : 2 }, (_, index) => (
        <View
          key={index}
          className={
            isActivity && !singleColumn && index < 4
              ? "min-w-32 flex-1 basis-1/3 gap-3 rounded-card border border-border-primary bg-surface p-4"
              : isActivity
                ? "w-full gap-3 rounded-card border border-border-primary bg-surface p-4"
                : "gap-3 rounded-card border border-border-primary bg-surface p-4"
          }
        >
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-8 w-16 rounded" />
          <Skeleton className="h-3 w-28 rounded" />
          {isActivity && index === 4 && (
            <Skeleton className="h-1.5 w-full rounded-full" />
          )}
        </View>
      ))}
    </View>
  );
}
