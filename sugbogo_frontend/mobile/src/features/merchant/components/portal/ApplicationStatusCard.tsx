import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { theme } from "@/constants/theme";

type ApplicationStatusCardProps = {
  status: "UNDER_REVIEW" | "APPROVED";
  submittedAt: string;
  estimatedReview?: string;
  approvedAt?: string;
};

/**
 * Displays the current merchant application status.
 *
 * Shown after the user has submitted their merchant application
 * and updated once the application has been approved.
 */
export default function ApplicationStatusCard({
  status,
  submittedAt,
  estimatedReview,
  approvedAt,
}: ApplicationStatusCardProps) {
  const isApproved = status === "APPROVED";

  return (
    <View className="bg-surface px-6 py-6">
      <Text className="mb-2 text-3xl font-bold text-text-primary">
        Application Status
      </Text>

      <Text className="mb-6 text-md text-text-secondary">
        Track the progress of your merchant application.
      </Text>

      <View>
        {/* Status */}
        <View className="flex-row items-start gap-3 py-3 border-b border-border-primary/60">
          <MaterialCommunityIcons
            name={isApproved ? "check-decagram" : "clock-outline"}
            size={22}
            color={
              isApproved
                ? theme.extends.colors.success
                : theme.extends.colors.error
            }
            style={{ marginTop: 2 }}
          />

          <View className="flex-1">
            <Text className="text-base font-bold text-text-primary">
              {isApproved ? "Approved" : "Under Review"}
            </Text>

            <Text className="mt-1 text-sm leading-5 text-text-secondary">
              {isApproved
                ? "Your business has been approved and is now part of SugboGo."
                : "Our team is currently reviewing your application."}
            </Text>
          </View>
        </View>

        {/* Submitted */}
        <View className="flex-row items-start gap-3 py-3 border-b border-border-primary/60">
          <Text className="w-6 pt-0.5 text-xl font-bold leading-6 text-text-primary">
            1
          </Text>

          <View className="flex-1">
            <Text className="text-base font-bold text-text-primary">
              Submitted
            </Text>

            <Text className="mt-1 text-sm leading-5 text-text-secondary">
              {submittedAt}
            </Text>
          </View>
        </View>

        {isApproved ? (
          <View className="flex-row items-start gap-3 py-3">
            <Text className="w-6 pt-0.5 text-xl font-bold leading-6 text-text-primary">
              2
            </Text>

            <View className="flex-1">
              <Text className="text-base font-bold text-text-primary">
                Approved
              </Text>

              <Text className="mt-1 text-sm leading-5 text-text-secondary">
                {approvedAt}
              </Text>
            </View>
          </View>
        ) : (
          <View className="flex-row items-start gap-3 py-3">
            <Text className="w-6 pt-0.5 text-xl font-bold leading-6 text-text-primary">
              2
            </Text>

            <View className="flex-1">
              <Text className="text-base font-bold text-text-primary">
                Estimated Review
              </Text>

              <Text className="mt-1 text-sm leading-5 text-text-secondary">
                {estimatedReview}
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
