import { ActivityIndicator, View } from "react-native";

import { theme } from "@/constants/theme";

type Props = {
  visible: boolean;
};

/**
 * Displays a loading overlay while the Google Map
 * finishes initializing.
 */
export default function MapLoadingOverlay({ visible }: Props) {
  if (!visible) {
    return null;
  }

  return (
    <View className="absolute inset-0 items-center justify-center bg-gray-100">
      <ActivityIndicator size="small" color={theme.extends.colors.brand} />
    </View>
  );
}
