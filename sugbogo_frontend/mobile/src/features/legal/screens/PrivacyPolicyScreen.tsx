import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AppText from "@/shared/components/AppText";

/** Displays a development placeholder while Privacy Policy content awaits approval. */
export default function PrivacyPolicyScreen() {
  return (
    <SafeAreaView
      edges={["bottom", "left", "right"]}
      className="flex-1 bg-background"
    >
      <ScrollView
        contentContainerClassName="px-6 py-6"
        showsVerticalScrollIndicator={false}
      >
        {/* Temporary content pending lead developer approval */}
        <AppText weight="semibold" className="text-sm text-text-secondary">
          Development placeholder
        </AppText>
        <AppText className="mt-2 text-base leading-6 text-text-primary">
          Privacy Policy content is under review and is not yet available.
        </AppText>
      </ScrollView>
    </SafeAreaView>
  );
}
