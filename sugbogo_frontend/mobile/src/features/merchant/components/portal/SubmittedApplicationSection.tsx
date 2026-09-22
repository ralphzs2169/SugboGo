import { MaterialCommunityIcons } from "@expo/vector-icons";
import LottieView from "lottie-react-native";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import DottedTimelineConnector from "@/shared/components/DottedTimelineConnector";

import underReviewAnimation from "../../assets/animations/under-review.json";

type SubmittedApplicationSectionProps = {
  submittedAt: string;
  estimatedReview?: string;
};

/**
 * Displays the merchant application's current post-submission status.
 *
 * Combines a focused under-review status header, the configured review SLA,
 * and a vertical timeline showing the application's progress.
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
          <AppText
            weight="bold"
            className="text-xs uppercase tracking-wide text-brand"
          >
            Under Review
          </AppText>
        </View>

        <AppText
          weight="bold"
          className="mt-3 text-center text-2xl text-text-primary"
        >
          We're reviewing your application
        </AppText>

        <AppText className="mt-2 max-w-sm text-center text-sm leading-6 text-text-secondary">
          Our team is carefully reviewing your submitted documents. We'll notify
          you once a decision has been made.
        </AppText>
      </View>

      {/* Review SLA */}
      <View className="mt-4 flex-row items-center rounded-md border border-border-primary bg-surface px-4 py-4">
        <MaterialCommunityIcons
          name="clock-fast"
          size={25}
          color={theme.extends.colors.text.secondary}
        />

        <View className="ml-3 flex-1">
          <AppText
            weight="semibold"
            className="text-xs uppercase tracking-wide text-text-secondary"
          >
            Estimated Review Time
          </AppText>

          <AppText weight="bold" className="mt-0.5 text-base text-text-primary">
            {estimatedReview ?? "Review in progress"}
          </AppText>
        </View>
      </View>

      {/* Application timeline */}
      <View className="mt-4 rounded-md border border-border-primary bg-surface px-5 py-5">
        <AppText weight="bold" className="mb-5 text-sm text-text-primary">
          Application Progress
        </AppText>

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
                    color={
                      step.state === "pending"
                        ? theme.extends.colors.text.secondary
                        : "#FFFFFF"
                    }
                  />
                </View>

                {!isLast && <DottedTimelineConnector className="my-1 h-10" />}
              </View>

              {/* Timeline content */}
              <View className={`ml-4 flex-1 ${isLast ? "" : "pb-5"}`}>
                <AppText
                  weight="bold"
                  className={`text-sm ${
                    step.state === "pending"
                      ? "text-text-secondary"
                      : "text-text-primary"
                  }`}
                >
                  {step.label}
                </AppText>

                <AppText className="mt-1 text-xs leading-5 text-text-secondary">
                  {step.detail}
                </AppText>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
