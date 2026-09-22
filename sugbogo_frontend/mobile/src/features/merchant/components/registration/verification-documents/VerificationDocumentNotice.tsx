import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

/**
 * Displays privacy guidance for verification-document uploads.
 *
 * Uses a restrained informational treatment so the notice is visible without
 * competing with the document upload controls.
 */
export default function VerificationDocumentNotice() {
  return (
    <View className="mx-screen-x mt-4 mb-5 flex-row items-start rounded-xl border border-text-info/10 bg-info px-4 py-3.5">
      {/* Document privacy guidance */}
      <MaterialCommunityIcons
        name="shield-lock-outline"
        size={20}
        color={theme.extends.colors.text.info}
      />

      <View className="ml-3 min-w-0 flex-1">
        <AppText weight="semibold" className="text-sm text-text-primary">
          Document privacy
        </AppText>

        <AppText className="mt-1 text-xs leading-5 text-text-secondary">
          Only upload documents related to your business application. Make sure
          you have permission to submit them. Your documents will be used for
          application verification and review.
        </AppText>
      </View>
    </View>
  );
}
