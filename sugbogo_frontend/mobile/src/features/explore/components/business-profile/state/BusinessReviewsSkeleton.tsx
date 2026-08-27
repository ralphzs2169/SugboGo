import { ScrollView, View } from "react-native";

import Skeleton from "@/shared/components/Skeleton";
import { SkeletonPulseProvider } from "@/shared/components/SkeletonPulseProvider";

type Props = {
  bottomInset: number;
};
/**
 * Mirrors the complete business reviews page while reviews are loading.
 *
 * Matches the review card structure and reserves space for the fixed action
 * footer so the loading state does not shift when the reviews arrive.
 */

export default function BusinessReviewsSkeleton({ bottomInset }: Props) {
  return (
    <SkeletonPulseProvider>
      <View className="flex-1 bg-surface">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="gap-3 px-4 pb-32 pt-5"
        >
          {/* Review card */}
          <View className="border-b border-border-primary px-4 py-4">
            {/* Review author */}
            <View className="flex-row items-center">
              <Skeleton className="h-[38px] w-[38px] rounded-full" />
              <View className="ml-3 flex-1">
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="mt-1.5 h-3 w-16 rounded-md" />
              </View>
              <Skeleton className="h-5 w-5 rounded-full" />
            </View>
            {/* Review content */}
            <View className="mt-3 gap-2">
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-[92%] rounded-md" />
              <Skeleton className="h-4 w-[68%] rounded-md" />
            </View>
            {/* Review photos */}
            <View className="mt-3 flex-row gap-2">
              <Skeleton className="aspect-square flex-1 rounded-lg" />
              <Skeleton className="aspect-square flex-1 rounded-lg" />
              <Skeleton className="aspect-square flex-1 rounded-lg" />
            </View>
            {/* Specialty vouches */}
            <View className="mt-4">
              <View className="mb-2 flex-row items-center">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="ml-1.5 h-3 w-20 rounded-md" />
              </View>
              <View className="flex-row flex-wrap gap-2">
                <Skeleton className="h-7 w-24 rounded-full" />
                <Skeleton className="h-7 w-28 rounded-full" />
              </View>
            </View>
            {/* Like action */}
            <View className="mt-3 flex-row items-center">
              <Skeleton className="h-[21px] w-[21px] rounded-full" />
              <Skeleton className="ml-1.5 h-3 w-5 rounded-md" />
            </View>
          </View>
          {/* Review card */}
          <View className="border-b border-border-primary px-4 py-4">
            {/* Review author */}
            <View className="flex-row items-center">
              <Skeleton className="h-[38px] w-[38px] rounded-full" />
              <View className="ml-3 flex-1">
                <Skeleton className="h-4 w-36 rounded-md" />
                <Skeleton className="mt-1.5 h-3 w-20 rounded-md" />
              </View>
              <Skeleton className="h-5 w-5 rounded-full" />
            </View>
            {/* Review content */}
            <View className="mt-3 gap-2">
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-[85%] rounded-md" />
            </View>
            {/* Like action */}
            <View className="mt-3 flex-row items-center">
              <Skeleton className="h-[21px] w-[21px] rounded-full" />
              <Skeleton className="ml-1.5 h-3 w-5 rounded-md" />
            </View>
          </View>
          {/* Review card */}
          <View className="border-b border-border-primary px-4 py-4">
            {/* Review author */}
            <View className="flex-row items-center">
              <Skeleton className="h-[38px] w-[38px] rounded-full" />
              <View className="ml-3 flex-1">
                <Skeleton className="h-4 w-24 rounded-md" />
                <Skeleton className="mt-1.5 h-3 w-16 rounded-md" />
              </View>
              <Skeleton className="h-5 w-5 rounded-full" />
            </View>
            {/* Review content */}
            <View className="mt-3 gap-2">
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-[94%] rounded-md" />
              <Skeleton className="h-4 w-[72%] rounded-md" />
            </View>
            {/* Specialty vouches */}
            <View className="mt-4">
              <View className="mb-2 flex-row items-center">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="ml-1.5 h-3 w-20 rounded-md" />
              </View>
              <View className="flex-row gap-2">
                <Skeleton className="h-7 w-28 rounded-full" />
              </View>
            </View>
            {/* Like action */}
            <View className="mt-3 flex-row items-center">
              <Skeleton className="h-[21px] w-[21px] rounded-full" />
              <Skeleton className="ml-1.5 h-3 w-5 rounded-md" />
            </View>
          </View>
        </ScrollView>
        {/* Fixed action footer placeholder */}
        <View
          className="absolute bottom-0 left-0 right-0 border-t border-border-primary bg-surface px-4 pt-3"
          style={{ paddingBottom: Math.max(bottomInset, 12) }}
        >
          <View className="flex-row gap-3">
            <Skeleton className="h-11 flex-1 rounded-full" />
            <Skeleton className="h-11 flex-1 rounded-full" />
          </View>
        </View>
      </View>
    </SkeletonPulseProvider>
  );
}
