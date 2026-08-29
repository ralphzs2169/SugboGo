import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import FixedFooter from "@/shared/components/FixedFooter";
import Skeleton from "@/shared/components/Skeleton";

import BusinessProfileSkeletonContent from "./BusinessProfileSkeletonContent";

/**
 * Full-screen standalone version of the skeleton, for any caller that needs
 * a loading screen outside of ExploreBusinessProfileScreen (which instead
 * renders BusinessProfileSkeletonContent directly inside
 * BusinessProfileScrollView to avoid remounting the scroll container on
 * load).
 */
export default function BusinessProfileSkeleton() {
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScrollView
        className="flex-1 bg-background"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-28"
      >
        <BusinessProfileSkeletonContent />
      </ScrollView>

      {/* Fixed footer */}
      <FixedFooter>
        <View className="flex-row gap-3">
          {/* Secondary CTA */}
          <Skeleton className="h-12 flex-1 rounded-full" />

          {/* Primary CTA */}
          <View className="flex-1 overflow-hidden rounded-full">
            <View className="h-12 bg-brand/30" />
          </View>
        </View>
      </FixedFooter>
    </SafeAreaView>
  );
}
