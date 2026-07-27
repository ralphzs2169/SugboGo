import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

type ApplicationStatusCardProps = {
  status: "UNDER_REVIEW" | "APPROVED";
  submittedAt: string;
  estimatedReview?: string;
  approvedAt?: string;
};

/**
 * Displays the current merchant application status.
 *
 * Used for submitted and approved merchant applications.
 */
export default function ApplicationStatusCard({
  status,
  submittedAt,
  estimatedReview,
  approvedAt,
}: ApplicationStatusCardProps) {
  const isApproved = status === "APPROVED";

  return (
    <View className="mx-6 mt-6 rounded-2xl bg-card p-5">
      <View className="flex-row items-center">
        <MaterialCommunityIcons
          name={isApproved ? "check-decagram" : "clock-outline"}
          size={22}
          color={isApproved ? "#22C55E" : "#F59E0B"}
        />

        <Text className="ml-2 text-lg font-bold text-foreground">
          {isApproved ? "Approved" : "Under Review"}
        </Text>
      </View>

      <View className="mt-5">
        <Text className="text-sm font-semibold text-muted-foreground">
          Submitted
        </Text>

        <Text className="mt-1 text-base text-foreground">{submittedAt}</Text>
      </View>

      {isApproved ? (
        <View className="mt-5">
          <Text className="text-sm font-semibold text-muted-foreground">
            Approved
          </Text>

          <Text className="mt-1 text-base text-foreground">{approvedAt}</Text>
        </View>
      ) : (
        <View className="mt-5">
          <Text className="text-sm font-semibold text-muted-foreground">
            Estimated Review
          </Text>

          <Text className="mt-1 text-base text-foreground">
            {estimatedReview}
          </Text>
        </View>
      )}
    </View>
  );
}
