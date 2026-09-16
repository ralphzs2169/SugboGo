import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import ErrorState from "@/shared/components/ErrorState";
import Skeleton from "@/shared/components/Skeleton";

type Props = {
  onRetry: () => void;
  onGoBack: () => void;
};

/**
 * Preserves the business profile's visual shell when the profile request fails.
 *
 * Mirrors the current hero and floating quick-info layout while presenting a
 * clear recovery state for retrying the failed profile request.
 */
export default function BusinessProfileErrorState({
  onRetry,
  onGoBack,
}: Props) {
  return (
    <View className="flex-1 bg-background">
      {/* Business hero and overlapping quick info */}
      <View className="bg-surface">
        {/* Hero placeholder */}
        <View className="relative h-80 w-full bg-surface-secondary">
          <Skeleton className="h-full w-full rounded-none" />

          {/* Back navigation */}
          <Pressable
            onPress={onGoBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="absolute left-4 top-4 h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/95 active:opacity-80"
            android_ripple={{
              color: "rgba(0,0,0,0.08)",
            }}
          >
            <MaterialCommunityIcons
              name="chevron-left"
              size={26}
              color={theme.extends.colors.text.primary}
            />
          </Pressable>
        </View>

        {/* Overlapping quick information */}
        <View className="relative z-10 -mt-8 px-4">
          <View
            className="flex-row items-stretch overflow-hidden rounded-xl border border-border-primary bg-surface"
            style={{
              shadowColor: "#000000",
              shadowOffset: {
                width: 0,
                height: 4,
              },
              shadowOpacity: 0.08,
              shadowRadius: 4,
            }}
          >
            {/* Review summary */}
            <View className="min-h-[76px] flex-1 items-center justify-center px-1 py-2">
              <Skeleton className="h-[18px] w-[18px] rounded-full" />
              <Skeleton className="mt-1 h-3.5 w-7 rounded-md" />
              <Skeleton className="mt-1 h-3 w-12 rounded-md" />
            </View>

            {/* Review/status divider */}
            <View className="my-3 w-px bg-border-primary" />

            {/* Operating status */}
            <View className="min-h-[76px] flex-1 items-center justify-center px-1 py-2">
              <Skeleton className="h-[18px] w-[18px] rounded-full" />
              <Skeleton className="mt-1 h-3.5 w-14 rounded-md" />
              <Skeleton className="mt-1 h-3 w-20 rounded-md" />
            </View>

            {/* Status/distance divider */}
            <View className="my-3 w-px bg-border-primary" />

            {/* Distance summary */}
            <View className="min-h-[76px] flex-1 items-center justify-center px-1 py-2">
              <Skeleton className="h-[18px] w-[18px] rounded-full" />
              <Skeleton className="mt-1 h-3.5 w-12 rounded-md" />
              <Skeleton className="mt-1 h-3 w-8 rounded-md" />
            </View>
          </View>
        </View>
      </View>

      {/* Profile loading error */}
      <View className="flex-1">
        <ErrorState
          size="small"
          icon="store-off-outline"
          title="Unable to load business"
          description="We couldn't load this business information. Please try again."
          primaryActionTitle="Retry"
          onPrimaryAction={onRetry}
          secondaryActionTitle="Go Back"
          onSecondaryAction={onGoBack}
        />
      </View>
    </View>
  );
}
