import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import ApplicationSubmittedIllustration from "../../assets/illustrations/application-submitted.svg";

type ApplicationStatusCardProps = {
  status: "UNDER_REVIEW" | "APPROVED";
  submittedAt: string;
  estimatedReview?: string;
  approvedAt?: string;
};

export default function ApplicationStatusCard({
  status,
  submittedAt,
  estimatedReview,
  approvedAt,
}: ApplicationStatusCardProps) {
  const isApproved = status === "APPROVED";

  return (
    <View className="bg-surface px-6 py-6">
      <Text className="text-3xl font-bold text-text-primary">
        Application Status
      </Text>

      <Text className="mt-2 text-base leading-6 text-text-secondary">
        Track the progress of your merchant application.
      </Text>

      <View className="items-center py-8">
        <ApplicationSubmittedIllustration width={180} height={180} />

        <View
          className={`mt-4 rounded-full px-4 py-2 ${
            isApproved ? "bg-success/10" : "bg-brand/10"
          }`}
        >
          <Text
            className={`font-bold ${
              isApproved ? "text-success" : "text-brand"
            }`}
          >
            {isApproved ? "Approved" : "Under Review"}
          </Text>
        </View>

        <Text className="mt-4 text-center text-xl font-bold text-text-primary">
          {isApproved
            ? "Your application has been approved!"
            : "We're reviewing your application"}
        </Text>

        <Text className="mt-2 text-center text-base leading-6 text-text-secondary">
          {isApproved
            ? "Congratulations! Your business is now part of SugboGo."
            : "Our team is carefully reviewing your submitted documents. We'll notify you once a decision has been made."}
        </Text>
      </View>

      <View className="rounded-2xl border border-border-primary bg-background px-5 py-2">
        {/* Submitted */}
        <View className="flex-row">
          <View className="items-center">
            <View className="h-7 w-7 items-center justify-center rounded-full bg-success">
              <MaterialCommunityIcons name="check" size={16} color="white" />
            </View>

            <View className="my-1 h-12 w-0.5 bg-border-primary" />
          </View>

          <View className="ml-4 flex-1 pb-6">
            <Text className="text-base font-bold text-text-primary">
              Application Submitted
            </Text>

            <Text className="mt-1 text-sm text-text-secondary">
              {submittedAt}
            </Text>
          </View>
        </View>

        {/* Current status */}
        <View className="flex-row">
          <View className="items-center">
            <View
              className={`h-7 w-7 items-center justify-center rounded-full ${
                isApproved ? "bg-success" : "bg-brand"
              }`}
            >
              <MaterialCommunityIcons
                name={isApproved ? "check" : "clock-outline"}
                size={15}
                color="white"
              />
            </View>
          </View>

          <View className="ml-4 flex-1 pb-2">
            <Text className="text-base font-bold text-text-primary">
              {isApproved ? "Application Approved" : "Estimated Review"}
            </Text>

            <Text className="mt-1 text-sm text-text-secondary">
              {isApproved ? approvedAt : estimatedReview}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
