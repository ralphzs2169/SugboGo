import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

type RejectionFeedbackCardProps = {
  /** Feedback provided by the administrator. */
  feedback: string[];

  /** Date the application review was completed. */
  reviewedAt: string;
};

/**
 * Displays administrator feedback for a rejected
 * merchant registration.
 *
 * This card explains why the application was rejected
 * and guides the merchant before resubmitting.
 */
export default function RejectionFeedbackCard({
  feedback,
  reviewedAt,
}: RejectionFeedbackCardProps) {
  return (
    <View className="mx-6 mt-6 rounded-2xl bg-card p-5">
      <View className="flex-row items-center">
        <MaterialCommunityIcons
          name="alert-circle-outline"
          size={22}
          color="#EF4444"
        />

        <Text className="ml-2 text-lg font-bold text-foreground">
          Application Requires Changes
        </Text>
      </View>

      <Text className="mt-5 text-sm font-semibold text-muted-foreground">
        Reviewed
      </Text>

      <Text className="mt-1 text-base text-foreground">{reviewedAt}</Text>

      <Text className="mt-5 text-sm font-semibold text-muted-foreground">
        Administrator Feedback
      </Text>

      <View className="mt-3">
        {feedback.map((item) => (
          <View key={item} className="mb-3 flex-row">
            <Text className="mr-2 text-red-500">•</Text>

            <Text className="flex-1 text-base text-foreground">{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
