import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { theme } from "@/constants/theme";

/**
 * Confirms that all administrator-requested changes have been
 * addressed before the merchant submits the application again.
 */
export default function ResubmissionConfirmationMessage() {
  return (
    <View>
      {/* Confirmation message */}
      <View className="flex-row">
        <MaterialCommunityIcons
          name="check-circle-outline"
          size={22}
          color={theme.extends.colors.success}
          style={{ marginTop: 2 }}
        />

        <Text className="ml-3 flex-1 text-sm leading-6 text-text-secondary">
          All requested changes have been made. Please review your application
          one last time before resubmitting.
        </Text>
      </View>
    </View>
  );
}
