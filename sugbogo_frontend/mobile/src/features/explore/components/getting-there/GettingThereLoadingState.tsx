import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import Skeleton from "@/shared/components/Skeleton";

type Props = {
  message: string;
};

/**
 * Keeps the Getting There structure visible while location or guidance loads.
 */
export default function GettingThereLoadingState({ message }: Props) {
  return (
    <View accessibilityLabel={message} accessibilityRole="progressbar">
      {/* Loading context */}
      <AppText className="mb-4 text-sm text-text-secondary">
        {message}
      </AppText>

      {/* Journey placeholder */}
      <View className="rounded-card border border-border-primary bg-surface p-4">
        <View className="flex-row items-center">
          <Skeleton className="h-12 w-16 rounded-xl" />

          <View className="ml-3 flex-1 gap-2">
            <Skeleton className="h-3 w-24 rounded-full" />
            <Skeleton className="h-4 w-3/4 rounded-full" />
            <Skeleton className="h-3 w-1/2 rounded-full" />
          </View>
        </View>

        <View className="mt-5 gap-4 border-t border-border-primary pt-5">
          {[0, 1, 2, 3].map((index) => (
            <View key={index} className="flex-row items-center">
              <Skeleton className="h-8 w-8 rounded-full" />
              <View className="ml-3 flex-1 gap-2">
                <Skeleton className="h-4 w-2/3 rounded-full" />
                <Skeleton className="h-3 w-1/2 rounded-full" />
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
