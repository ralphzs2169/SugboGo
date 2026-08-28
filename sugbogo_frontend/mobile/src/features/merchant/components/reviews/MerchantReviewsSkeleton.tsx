import { View } from "react-native";

import Skeleton from "@/shared/components/Skeleton";

/** Mirrors the merchant review card hierarchy while the list is loading. */
export default function MerchantReviewsSkeleton() {
  return (
    <View className="flex-1 bg-background px-4 pt-4">
      <Skeleton className="h-7 w-32 rounded-md" />
      <Skeleton className="mt-2 h-4 w-52 rounded-md" />
      <View className="mt-5 flex-row gap-2">
        <Skeleton className="h-10 w-20 rounded-full" />
        <Skeleton className="h-10 w-28 rounded-full" />
        <Skeleton className="h-10 w-20 rounded-full" />
      </View>
      {[1, 2, 3].map((item) => (
        <View
          key={item}
          className="mt-4 rounded-card border border-border-primary bg-surface p-4"
        >
          <View className="flex-row items-center">
            <Skeleton className="h-10 w-10 rounded-full" />
            <View className="ml-3 flex-1">
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="mt-2 h-3 w-16 rounded-md" />
            </View>
          </View>
          <Skeleton className="mt-4 h-4 w-full rounded-md" />
          <Skeleton className="mt-2 h-4 w-[80%] rounded-md" />
          <View className="mt-4 flex-row justify-end">
            <Skeleton className="h-11 w-20 rounded-full" />
          </View>
        </View>
      ))}
    </View>
  );
}
