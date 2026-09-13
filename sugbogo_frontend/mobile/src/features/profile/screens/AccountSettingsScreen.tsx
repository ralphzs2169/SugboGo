import { ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AccountSettingsScreen() {
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1 bg-background"
    >
      <ScrollView
        contentContainerClassName="p-4"
        showsVerticalScrollIndicator={false}
      >
        <Text className="mb-4 text-lg font-bold text-text">
          Account Settings
        </Text>
        <Text className="text-sm leading-5 text-text-secondary">
          Additional account preferences will appear here when available.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
