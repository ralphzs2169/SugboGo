import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import underReviewAnimation from "../../assets/animations/under-review.json";
import LottieView from "lottie-react-native";

type SubmittedApplicationSectionProps = {
  submittedAt: string;
  estimatedReview?: string;
};

/**
 * Displays the merchant application's current post-submission status.
 *
 * Combines a focused under-review status header, the configured review SLA,
 * and a simple vertical timeline showing the application's progress.
 */
export default function SubmittedApplicationSection({
  submittedAt,
  estimatedReview,
}: SubmittedApplicationSectionProps) {
  const steps = [
    {
      label: "Application Submitted",
      detail: submittedAt,
      icon: "check" as const,
      state: "done" as const,
    },
    {
      label: "Under Review",
      detail: estimatedReview ?? "Review in progress",
      icon: "clock-outline" as const,
      state: "current" as const,
    },
    {
      label: "Application Decision",
      detail: "Pending review",
      icon: "check" as const,
      state: "pending" as const,
    },
  ];

  return (
    <View className="bg-surface px-6 pb-6">
      {/* Status hero */}
      <View className="items-center rounded-3xl bg-surface px-6 pb-7">
        <LottieView
          source={underReviewAnimation}
          autoPlay
          loop={false}
          style={{ width: 100, height: 100 }}
        />

        <View className="mt-4 rounded-full bg-brand/10 px-3.5 py-1.5">
          <Text className="text-xs font-bold uppercase tracking-wide text-brand">
            Under Review
          </Text>
        </View>

        <Text className="mt-3 text-center text-2xl font-bold text-text-primary">
          We're reviewing your application
        </Text>

        <Text className="mt-2 max-w-sm text-center text-sm leading-6 text-text-secondary">
          Our team is carefully reviewing your submitted documents. We'll notify
          you once a decision has been made.
        </Text>
      </View>

      {/* Review SLA */}
      <View className="mt-4 flex-row items-center rounded-2xl border border-border-primary bg-surface px-4 py-4">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-brand">
          <MaterialCommunityIcons name="clock-fast" size={21} color="white" />
        </View>

        <View className="ml-3 flex-1">
          <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Estimated Review Time
          </Text>

          <Text className="mt-0.5 text-base font-bold text-text-primary">
            {estimatedReview ?? "Review in progress"}
          </Text>
        </View>
      </View>

      {/* Application timeline */}
      <View className="mt-4 rounded-2xl border border-border-primary bg-surface px-5 py-5">
        <Text className="mb-5 text-sm font-bold text-text-primary">
          Application Progress
        </Text>

        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;

          return (
            <View key={step.label} className="flex-row">
              {/* Timeline indicator */}
              <View className="items-center">
                <View
                  className={`h-9 w-9 items-center justify-center rounded-full ${
                    step.state === "done"
                      ? "bg-success"
                      : step.state === "current"
                        ? "bg-brand"
                        : "border-2 border-border-primary bg-surface"
                  }`}
                >
                  <MaterialCommunityIcons
                    name={step.icon}
                    size={17}
                    color={step.state === "pending" ? "gray" : "white"}
                  />
                </View>

                {!isLast && (
                  <View
                    className={`my-1 h-10 w-0.5 ${
                      step.state === "done"
                        ? "bg-success/30"
                        : "bg-border-primary"
                    }`}
                  />
                )}
              </View>

              {/* Timeline content */}
              <View className={`ml-4 flex-1 ${isLast ? "" : "pb-5"}`}>
                <Text
                  className={`text-sm font-bold ${
                    step.state === "pending"
                      ? "text-text-secondary"
                      : "text-text-primary"
                  }`}
                >
                  {step.label}
                </Text>

                <Text className="mt-1 text-xs leading-5 text-text-secondary">
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
