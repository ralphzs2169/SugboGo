import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { theme } from "@/constants/theme";
import type { ApplicationFeedbackResponse } from "@/features/merchant/types/registration/registrationApi.types";

type UnresolvedFeedbackMessageProps = {
  feedback: ApplicationFeedbackResponse[];
};

const SECTION_LABELS: Record<ApplicationFeedbackResponse["section"], string> = {
  identity: "Business Identity",
  location: "Business Location",
  operating_hours: "Operating Hours",
  photos: "Business Photos",
  documents: "Verification Documents",
};

/**
 * Displays a reminder before a rejected application is
 * resubmitted.
 *
 * The modal reminds merchants which sections received
 * administrator feedback so they can double-check their
 * revisions before submitting again.
 */
export default function UnresolvedFeedbackMessage({
  feedback,
}: UnresolvedFeedbackMessageProps) {
  const sections = [
    ...new Set(feedback.map((item) => SECTION_LABELS[item.section])),
  ];

  return (
    <View>
      <View className="mb-4 flex-row items-start">
        <MaterialCommunityIcons
          name="information-outline"
          size={22}
          color={theme.extends.colors.brand}
          style={{ marginTop: 2 }}
        />

        <Text className="ml-3 flex-1 text-sm leading-6 text-text-secondary">
          Before resubmitting, please make sure you've addressed the
          administrator's feedback for the following section
          {sections.length > 1 ? "s" : ""}.
        </Text>
      </View>

      <View className="mb-4 rounded-xl border border-border-primary bg-background p-4">
        {sections.map((section) => (
          <View key={section} className="mb-2 flex-row items-center last:mb-0">
            <MaterialCommunityIcons
              name="chevron-right"
              size={18}
              color={theme.extends.colors.brand}
            />

            <Text className="ml-2 flex-1 text-sm font-medium text-text-primary">
              {section}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
