import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";
import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";

/** Provides the compact, safe-area-owned header for device storage and saved journeys. */
export default function OfflineStorageHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <View className="flex-row items-center gap-2 border-b border-border-primary bg-surface px-4 py-3">
      <SafePressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={onBack}
        className="min-h-12 min-w-12 cursor-pointer items-center justify-center rounded-full active:bg-surface-muted"
      >
        <MaterialCommunityIcons
          name="chevron-left"
          size={28}
          color={theme.extends.colors.text.primary}
          accessible={false}
        />
      </SafePressable>
      <AppText
        accessibilityRole="header"
        weight="bold"
        className="min-w-0 flex-1 text-xl text-text-primary"
      >
        {title}
      </AppText>
    </View>
  );
}
