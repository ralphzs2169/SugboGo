import { View } from "react-native";
import Skeleton from "@/shared/components/Skeleton";

/** Displays placeholders for business identity, endorsements and the latest date. */
export default function VouchHistorySkeleton() {
  return (
    <View testID="vouch-history-loading">
      {Array.from({ length: 4 }).map((_, index) => (
        <View
          key={index}
          className="mx-4 mb-3 rounded-card border border-border-primary bg-surface p-4"
        >
          {/* Business identity */}
          <View className="flex-row gap-3">
            <Skeleton className="h-20 w-20 rounded-xl" />
            <View className="flex-1 justify-center gap-2">
              <Skeleton className="h-4 w-4/5 rounded-md" />
              <Skeleton className="h-3 w-1/2 rounded-md" />
            </View>
          </View>
          {/* Endorsements and date */}
          <View className="mt-3 flex-row gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </View>
          <Skeleton className="mt-2 h-3 w-1/2 rounded-md" />
        </View>
      ))}
    </View>
  );
}
