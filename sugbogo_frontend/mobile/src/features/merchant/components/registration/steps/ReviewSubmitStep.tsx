import { View } from "react-native";

import type {
  CategoryOption,
  ClusterOption,
} from "@/features/merchant/types/registration/registrationOption.types";
import type {
  ApplicationFeedbackResponse,
  ApplicationFeedbackSection,
} from "@/features/merchant/types/registration/registrationApi.types";
import type { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";
import { useFormContext } from "react-hook-form";

import ReviewSection from "../review/ReviewSection";
import ReviewBusinessIdentity from "../review/sections/ReviewBusinessIdentity";
import ReviewBusinessLocation from "../review/sections/ReviewBusinessLocation";
import ReviewBusinessPhotos from "../review/sections/ReviewBusinessPhotos";
import ReviewOperatingHours from "../review/sections/ReviewOperatingHours";
import ReviewVerificationDocuments from "../review/sections/ReviewVerificationDocuments";
import ResubmissionChecklist from "../ResubmissionChecklist";

type ReviewSubmitStepProps = {
  clusters: ClusterOption[];
  categories: CategoryOption[];
  onEditSection: (step: number) => void;
  isResubmission?: boolean;
  feedback: ApplicationFeedbackResponse[];
};

export default function ReviewSubmitStep({
  clusters,
  categories,
  onEditSection,
  isResubmission = false,
  feedback,
}: ReviewSubmitStepProps) {
  const { watch } = useFormContext<MerchantRegistrationForm>();
  const form = watch();

  const getSectionFeedback = (section: ApplicationFeedbackSection) => {
    if (!isResubmission) {
      return undefined;
    }

    return feedback.find((item) => item.section === section);
  };

  return (
    <>
      <View className="">
        <ReviewSection
          icon="check-circle-outline"
          title={
            isResubmission ? "Review Your Changes" : "Review Your Application"
          }
          description={
            isResubmission
              ? "Review your updates before resubmitting your application."
              : "Check your information before submitting your application."
          }
          isPageHeader
          showBorder={false}
        />

        {isResubmission && (
          <ResubmissionChecklist feedback={feedback} padding />
        )}
        <ReviewBusinessIdentity
          form={form}
          clusters={clusters}
          categories={categories}
          onEdit={() => onEditSection(1)}
          feedback={getSectionFeedback("identity")}
        />

        <ReviewBusinessLocation
          form={form}
          onEdit={() => onEditSection(2)}
          returnTo="registration-review"
          feedback={getSectionFeedback("location")}
        />

        <ReviewOperatingHours
          form={form}
          onEdit={() => onEditSection(3)}
          feedback={getSectionFeedback("operating_hours")}
        />
        <ReviewBusinessPhotos
          form={form}
          onEdit={() => onEditSection(4)}
          feedback={getSectionFeedback("photos")}
        />
        <ReviewVerificationDocuments
          form={form}
          onEdit={() => onEditSection(5)}
          feedback={getSectionFeedback("documents")}
        />
      </View>
    </>
  );
}
