import { View } from "react-native";

import Skeleton from "@/shared/components/Skeleton";

/**
 * Displays chip-shaped loading placeholders while onboarding specialty
 * interests are being retrieved.
 */
export default function InterestGridSkeleton() {
  return (
    <View testID="onboarding-interests-loading" className="flex-row flex-wrap">
      {/* Specialty chip placeholders */}
      <Skeleton className="mb-2 mr-2 h-12 w-28 rounded-full" />
      <Skeleton className="mb-2 mr-2 h-12 w-36 rounded-full" />
      <Skeleton className="mb-2 mr-2 h-12 w-24 rounded-full" />
      <Skeleton className="mb-2 mr-2 h-12 w-32 rounded-full" />
      <Skeleton className="mb-2 mr-2 h-12 w-20 rounded-full" />
      <Skeleton className="mb-2 mr-2 h-12 w-40 rounded-full" />
      <Skeleton className="mb-2 mr-2 h-12 w-28 rounded-full" />
      <Skeleton className="mb-2 mr-2 h-12 w-24 rounded-full" />
      <Skeleton className="mb-2 mr-2 h-12 w-36 rounded-full" />
      <Skeleton className="mb-2 mr-2 h-12 w-20 rounded-full" />
      <Skeleton className="mb-2 mr-2 h-12 w-32 rounded-full" />
      <Skeleton className="mb-2 mr-2 h-12 w-28 rounded-full" />
    </View>
  );
}
