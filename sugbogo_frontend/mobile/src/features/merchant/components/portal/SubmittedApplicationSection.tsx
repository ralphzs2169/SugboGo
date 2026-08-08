import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import ApplicationSubmittedIllustration from "../../assets/illustrations/application-submitted.svg";

type SubmittedApplicationSectionProps = {
  status: "UNDER_REVIEW" | "APPROVED";
  submittedAt: string;
  estimatedReview?: string;
  approvedAt?: string;
};

export default function SubmittedApplicationSection({
  status,
  submittedAt,
  estimatedReview,
  approvedAt,
}: SubmittedApplicationSectionProps) {
  const isApproved = status === "APPROVED";

  const steps = [
    {
      label: "Application Submitted",
      detail: submittedAt,
      icon: "check" as const,
      state: "done" as const,
    },
    {
      label: "Under Review",
      detail: isApproved ? approvedAt : estimatedReview,
      icon: isApproved ? ("check" as const) : ("clock-outline" as const),
      state: isApproved ? ("done" as const) : ("current" as const),
    },
    {
      label: "Approved",
      detail: isApproved ? approvedAt : "Pending review",
      icon: "check" as const,
      state: isApproved ? ("done" as const) : ("pending" as const),
    },
  ];

  return (
    <View className="bg-surface px-6 pb-6">
      <View className="items-center pb-8">
        <ApplicationSubmittedIllustration width="100%" height={180} />

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

      <View className="rounded-2xl border border-border-primary bg-background px-5 py-4">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;

          return (
            <View key={step.label} className="flex-row">
              <View className="items-center">
                <View
                  className={`h-7 w-7 items-center justify-center rounded-full ${
                    step.state === "pending"
                      ? "border-2 border-border-primary bg-background"
                      : step.state === "current"
                        ? "bg-brand"
                        : "bg-success"
                  }`}
                >
                  {step.state !== "pending" && (
                    <MaterialCommunityIcons
                      name={step.icon}
                      size={16}
                      color="white"
                    />
                  )}
                </View>

                {!isLast && (
                  <View className="my-1 h-12 w-0.5 bg-border-primary" />
                )}
              </View>

              <View className={`ml-4 flex-1 ${isLast ? "" : "pb-6"}`}>
                <Text
                  className={`text-base font-bold ${
                    step.state === "pending"
                      ? "text-text-secondary"
                      : "text-text-primary"
                  }`}
                >
                  {step.label}
                </Text>

                <Text className="mt-1 text-sm text-text-secondary">
                  {step.detail}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
