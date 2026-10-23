import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

/** Displays development-stage support information pending official contact approval. */
export default function ContactSupportScreen() {
  return (
    <SafeAreaView
      edges={["bottom", "left", "right"]}
      className="flex-1 bg-background"
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 py-6"
        showsVerticalScrollIndicator={false}
      >
        {/* Support introduction; the route owns the screen title. */}
        <AppText className="text-base leading-6 text-text-primary">
          Need help with SugboGo? Contact our support team for assistance with your
          account or questions about the app.
        </AppText>

        {/* Temporary information; no active support destination is approved. */}
        <View className="mt-6 flex-row items-start gap-3 rounded-xl border border-border-primary bg-surface p-4">
          <MaterialCommunityIcons
            name="information-outline"
            size={24}
            color={theme.extends.colors.brand}
            accessible={false}
            importantForAccessibility="no"
          />
          <AppText className="min-w-0 flex-1 text-base leading-6 text-text-secondary">
            Support contact details are awaiting team approval and are not yet
            available.
          </AppText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
