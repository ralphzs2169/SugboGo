import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import type { UserLocationStatus } from "@/shared/hooks/useUserLocation";

type Props = {
  status: Extract<UserLocationStatus, "denied" | "unavailable">;
  isRetrying: boolean;
  onRetry: () => void;
};

/**
 * Provides location-specific recovery before a journey request can run.
 */
export default function LocationUnavailableState({
  status,
  isRetrying,
  onRetry,
}: Props) {
  const description =
    status === "denied"
      ? "SugboGo needs location permission to find convenient jeepney routes from where you are."
      : "SugboGo couldn't get your current location. Check that location services are available, then try again.";

  return (
    <View className="items-center rounded-card border border-border-primary bg-surface px-5 py-8">
      {/* Location guidance */}
      <View className="h-14 w-14 items-center justify-center rounded-full bg-brand/10">
        <MaterialCommunityIcons
          name="crosshairs-gps"
          size={28}
          color={theme.extends.colors.brand}
        />
      </View>

      <AppText
        weight="bold"
        className="mt-4 text-center text-lg text-text-primary"
      >
        Location needed
      </AppText>

      <AppText className="mt-2 text-center text-sm leading-5 text-text-secondary">
        {description}
      </AppText>

      {/* Permission or location retry */}
      <Button
        title="Try Again"
        onPress={onRetry}
        loading={isRetrying}
        rounded="full"
        className="mt-5 min-w-36 py-3"
        fontClassName="text-sm"
      />
    </View>
  );
}
