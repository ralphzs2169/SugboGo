import { View } from "react-native";

import type {
  CategoryOption,
  ClusterOption,
} from "@/features/merchant/types/registration/registrationOption.types";
import type { ApplicationFeedbackResponse } from "@/features/merchant/types/registration/registrationApi.types";
import type { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";
import { useFormContext } from "react-hook-form";

import AdministratorFeedback from "../AdministratorFeedback";
import ReviewSection from "../review/ReviewSection";
import ReviewBusinessIdentity from "../review/sections/ReviewBusinessIdentity";
import ReviewBusinessLocation from "../review/sections/ReviewBusinessLocation";
import ReviewBusinessPhotos from "../review/sections/ReviewBusinessPhotos";
import ReviewOperatingHours from "../review/sections/ReviewOperatingHours";
import ReviewVerificationDocuments from "../review/sections/ReviewVerificationDocuments";

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
          <AdministratorFeedback feedback={feedback ?? []} padding />
        )}

        <ReviewBusinessIdentity
          form={form}
          clusters={clusters}
          categories={categories}
          onEdit={() => onEditSection(1)}
        />

        <ReviewBusinessLocation
          form={form}
          onEdit={() => onEditSection(2)}
          returnTo="registration-review"
        />

        <ReviewOperatingHours form={form} onEdit={() => onEditSection(3)} />
        <ReviewBusinessPhotos form={form} onEdit={() => onEditSection(4)} />
        <ReviewVerificationDocuments
          form={form}
          onEdit={() => onEditSection(5)}
        />
      </View>
    </>
  );
}
