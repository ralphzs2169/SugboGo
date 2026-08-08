import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { theme } from "@/constants/theme";
import type { ApplicationFeedbackResponse } from "@/features/merchant/types/registration/registrationApi.types";

type ReviewResubmissionFeedbackProps = {
  feedback: ApplicationFeedbackResponse[];
  padding?: boolean;
};

const SECTION_LABELS: Record<ApplicationFeedbackResponse["section"], string> = {
  identity: "Business Identity",
  location: "Business Location",
  operating_hours: "Operating Hours",
  photos: "Business Photos",
  documents: "Verification Documents",
};

/**
 * Displays administrator feedback for rejected merchant
 * applications before the merchant reviews and resubmits.
 *
 * Feedback is grouped by registration section so merchants
 * can quickly identify which parts of the application require
 * changes before resubmission.
 */
export default function AdministratorFeedback({
  feedback,
  padding = false,
}: ReviewResubmissionFeedbackProps) {
  // Groups feedback items by registration section.
  const grouped = feedback.reduce<
    Record<string, ApplicationFeedbackResponse[]>
  >((groups, item) => {
    if (!groups[item.section]) {
      groups[item.section] = [];
    }

    groups[item.section].push(item);

    return groups;
  }, {});

  if (feedback.length === 0) {
    return (
      <View
        className={` relative border-b border-border-primary bg-surface py-6 ${padding ? "px-6" : ""}`}
      >
        <MaterialCommunityIcons
          name="information-outline"
          size={22}
          color={theme.extends.colors.brand}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 10,
          }}
        />

        <View className="rounded-md border border-border-primary bg-background p-4">
          <View className="py-2">
            <Text className="text-xs font-bold text-text-secondary">
              ADMINISTRATOR FEEDBACK
            </Text>

            <View className="mt-1">
              <Text className="text-sm leading-6 text-text-primary">
                No section-specific feedback has been provided for this
                application. Please review your application carefully before
                resubmitting, or contact the administrator if you need further
                clarification.
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      className={`mb-4 relative border-b border-border-primary bg-surface ${padding ? "px-6 py-6" : "py-6"}`}
    >
      <MaterialCommunityIcons
        name="alert-circle"
        size={22}
        color={theme.extends.colors.error}
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 10,
        }}
      />

      <View className="rounded-md border border-border-error bg-red-50 p-4">
        {Object.entries(grouped).map(([section, items]) => (
          <View
            key={section}
            className="border-t border-border-primary py-5 first:border-t-0 first:pt-0"
          >
            <Text className="text-xs font-bold text-text-secondary">
              {SECTION_LABELS[section as keyof typeof SECTION_LABELS]}
            </Text>

            <View className="mt-1">
              {items.map((item, index) => (
                <Text
                  key={`${section}-${index}`}
                  className="text-sm leading-6 text-text-primary"
                >
                  • {item.message}
                </Text>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
