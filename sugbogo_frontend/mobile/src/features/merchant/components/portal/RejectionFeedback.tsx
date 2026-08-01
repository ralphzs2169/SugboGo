import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { theme } from "@/constants/theme";

type RejectionFeedbackCardProps = {
  feedback: string[];
  reviewedAt: string;
};

/**
 * Displays administrator feedback for a rejected
 * merchant registration.
 *
 * Shown when the merchant application requires
 * revisions before it can be resubmitted.
 */
export default function RejectionFeedbackCard({
  feedback,
  reviewedAt,
}: RejectionFeedbackCardProps) {
  return (
    <View className="bg-surface px-6 py-6">
      <Text className="mb-2 text-3xl font-bold text-text-primary">
        Application feedback
      </Text>

      <Text className="mb-6 text-md text-text-secondary">
        Please review the administrator's comments below before updating and
        resubmitting your application.
      </Text>

      <View>
        {/* Status */}
        <View className="flex-row items-start gap-3 border-b border-border-primary/60 py-3">
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={22}
            color={theme.extends.colors.error}
            style={{ marginTop: 2 }}
          />

          <View className="flex-1">
            <Text className="text-base font-bold text-text-primary">
              Changes Required
            </Text>

            <Text className="mt-1 text-sm leading-5 text-text-secondary">
              Your application needs a few updates before it can be approved.
            </Text>
          </View>
        </View>

        {/* Reviewed */}
        <View className="flex-row items-start gap-3 border-b border-border-primary/60 py-3">
          <MaterialCommunityIcons
            name="calendar-check-outline"
            size={22}
            color={theme.extends.colors.brand}
            style={{ marginTop: 2 }}
          />

          <View className="flex-1">
            <Text className="text-base font-bold text-text-primary">
              Reviewed
            </Text>

            <Text className="mt-1 text-sm leading-5 text-text-secondary">
              {reviewedAt}
            </Text>
          </View>
        </View>

        {/* Feedback */}
        <View className="py-3">
          <Text className="mb-4 text-base font-bold text-text-primary">
            Administrator comments
          </Text>

          {feedback.map((item) => (
            <View key={item} className="mb-3 flex-row items-start">
              <MaterialCommunityIcons
                name="chevron-right"
                size={18}
                color={theme.extends.colors.brand}
                style={{ marginTop: 2 }}
              />

              <Text className="ml-2 flex-1 text-sm leading-6 text-text-secondary">
                {item}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
