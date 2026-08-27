import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";
import Skeleton from "@/shared/components/Skeleton";

type Props = {
  onRetry: () => void;
  onGoBack: () => void;
};

/**
 * Preserves the business profile's visual shell when the profile request
 * fails, while presenting a clear recovery state instead of a blank screen.
 */
export default function BusinessProfileErrorState({
  onRetry,
  onGoBack,
}: Props) {
  return (
    <View className="flex-1 bg-background">
      {/* Hero placeholder */}
      <View className="relative h-72 w-full bg-surface-secondary">
        <Skeleton className="h-full w-full rounded-none" />

        {/* Back button */}
        <Pressable
          onPress={() => router.back()}
          className="absolute left-4 top-4 h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/95 active:opacity-80"
          android_ripple={{ color: "rgba(0,0,0,0.08)" }}
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={26}
            color={theme.extends.colors.text.primary}
          />
        </Pressable>
      </View>

      {/* Quick information placeholders */}
      <View className="flex-row border-b border-border-primary bg-surface">
        <View className="flex-1 items-center justify-center py-4">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="mt-2 h-3 w-16 rounded-md" />
        </View>

        <View className="flex-1 items-center justify-center border-x border-border-primary py-4">
          <Skeleton className="h-4 w-20 rounded-md" />
          <Skeleton className="mt-2 h-3 w-24 rounded-md" />
        </View>

        <View className="flex-1 items-center justify-center py-4">
          <Skeleton className="h-4 w-14 rounded-md" />
          <Skeleton className="mt-2 h-3 w-10 rounded-md" />
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
