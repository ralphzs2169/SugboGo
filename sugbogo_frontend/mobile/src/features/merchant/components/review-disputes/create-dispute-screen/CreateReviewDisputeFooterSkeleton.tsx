import { View } from "react-native";

import Skeleton from "@/shared/components/Skeleton";

/**
 * Mirrors the fixed submission footer while the dispute form is loading.
 */
export default function CreateReviewDisputeFooterSkeleton() {
  return (
    <View className="border-t border-border-primary bg-surface px-4 pb-3 pt-3">
      {/* Submit action */}
      <Skeleton className="h-12 w-full rounded-full" />

      {/* Submission guidance */}
      <Skeleton className="mx-auto mt-2 h-3 w-64 rounded-md" />
    </View>
  );
}
