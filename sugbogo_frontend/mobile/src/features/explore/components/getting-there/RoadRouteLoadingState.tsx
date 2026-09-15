import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import Skeleton from "@/shared/components/Skeleton";

type Props = {
  message: string;
};

/** Keeps the route summary and map structure visible while data loads. */
export default function RoadRouteLoadingState({ message }: Props) {
  return (
    <View className="flex-1" accessibilityLabel={message} accessibilityRole="progressbar">
      {/* Loading context */}
      <AppText className="mb-4 text-sm text-text-secondary">
        {message}
      </AppText>

      {/* Route summary and map placeholders */}
      <View className="mb-4 flex-row gap-3">
        <Skeleton className="h-16 flex-1 rounded-card" />
        <Skeleton className="h-16 flex-1 rounded-card" />
      </View>
      <Skeleton className="flex-1 rounded-card" />
    </View>
  );
}
