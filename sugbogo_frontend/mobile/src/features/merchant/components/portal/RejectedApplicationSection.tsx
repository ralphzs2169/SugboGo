import LottieView from "lottie-react-native";
import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import DuplicateResubmissionWarning from "../registration/DuplicateResubmissionWarning";

import rejectedApplicationAnimation from "../../assets/animations/changes-required.json";
import type {
  ApplicationFeedbackResponse,
  DuplicateDisposition,
} from "../../types/registration/registrationApi.types";
import ResubmissionChecklist from "../registration/ResubmissionChecklist";
import DuplicateRejectionNotice from "../registration/DuplicateRejectionNotice";
import RejectionCardIndicator from "../registration/RejectionCardIndicator";

type RejectionApplicationSectionProps = {
  feedback: ApplicationFeedbackResponse[];
  reviewedAt: string;
  duplicateDisposition?: DuplicateDisposition | null;
};

/**
 * Displays the merchant application's rejected state.
 *
 * Uses the same status-first visual structure as the submitted application
 * state while focusing the merchant on required changes and review feedback.
 */
export default function RejectionApplicationSection({
  feedback,
  reviewedAt,
  duplicateDisposition,
}: RejectionApplicationSectionProps) {
  const combinedRejection = !!duplicateDisposition && feedback.length > 0;
  const correctionsComplete =
    feedback.length > 0 && feedback.every((item) => item.is_changed);
  return (
    <View className="bg-surface px-6 pb-6">
      {/* Status hero */}
      <View className="items-center rounded-3xl bg-surface px-6 py-4">
        <LottieView
          source={rejectedApplicationAnimation}
          autoPlay
          loop={false}
          style={{ width: 80, height: 80 }}
        />

        <View className="mt-4 rounded-full bg-text-error/10 px-3.5 py-1.5">
          <AppText
            weight="bold"
            className="text-xs uppercase tracking-wide text-text-error"
          >
            {duplicateDisposition ? "Rejected" : "Changes Required"}
          </AppText>
        </View>

        <AppText
          weight="bold"
          className="mt-3 text-center text-2xl text-text-primary"
        >
          {duplicateDisposition ? "Application Rejected" : "Changes Required"}
        </AppText>

        <AppText className="mt-2 max-w-sm text-center text-sm leading-6 text-text-secondary">
          Reviewed {reviewedAt}
        </AppText>
      </View>

      <DuplicateRejectionNotice
        disposition={duplicateDisposition}
        showIndicator={!correctionsComplete}
      >
        {combinedRejection && (
          <ResubmissionChecklist
            feedback={feedback}
            isInMerchantPortal
            embedded
          />
        )}
      </DuplicateRejectionNotice>
      {duplicateDisposition && <DuplicateResubmissionWarning />}
      {/* Administrator feedback */}
      {feedback.length > 0 && !duplicateDisposition && (
        <View className="relative rounded-card border border-border-primary bg-surface px-4 pt-4">
          {!correctionsComplete && <RejectionCardIndicator />}
          <AppText weight="bold" className="mb-1 text-sm text-text-primary">
            Administrator Feedback
          </AppText>

          <ResubmissionChecklist feedback={feedback} isInMerchantPortal />
        </View>
      )}
    </View>
  );
}
