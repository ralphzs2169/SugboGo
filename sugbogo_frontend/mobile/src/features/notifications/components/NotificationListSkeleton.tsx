import { View } from "react-native";

import Skeleton from "@/shared/components/Skeleton";

/** Mirrors compact notification rows during the initial inbox request. */
export default function NotificationListSkeleton() {
  return (
    <View testID="notification-list-skeleton">
      {/* Notification row placeholders */}
      {[0, 1, 2, 3, 4].map((item) => (
        <View
          key={item}
          className="flex-row gap-3 border-b border-border-primary px-5 py-4"
        >
          <Skeleton className="h-10 w-10 rounded-full" />

          <View className="flex-1">
            <Skeleton className="h-4 w-3/5 rounded-md" />
            <Skeleton className="mt-2 h-3.5 w-full rounded-md" />
            <Skeleton className="mt-2 h-3.5 w-4/5 rounded-md" />
            <Skeleton className="mt-3 h-3 w-20 rounded-md" />
          </View>
        </View>
      ))}
    </View>
  );
}
