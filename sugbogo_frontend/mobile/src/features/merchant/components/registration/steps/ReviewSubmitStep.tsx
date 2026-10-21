import { View } from "react-native";

import type {
  CategoryOption,
  ClusterOption,
} from "@/features/merchant/types/registration/registrationOption.types";
import type {
  ApplicationFeedbackResponse,
  ApplicationFeedbackSection,
  ApplicationDetailResponse,
} from "@/features/merchant/types/registration/registrationApi.types";
import type { MerchantRegistrationForm } from "@/features/merchant/validation/merchantRegistration.schema";
import { useFormContext } from "react-hook-form";

import ReviewBusinessIdentity from "../review/sections/ReviewBusinessIdentity";
import ReviewBusinessLocation from "../review/sections/ReviewBusinessLocation";
import ReviewBusinessPhotos from "../review/sections/ReviewBusinessPhotos";
import ReviewOperatingHours from "../review/sections/ReviewOperatingHours";
import ReviewVerificationDocuments from "../review/sections/ReviewVerificationDocuments";
import ResubmissionChecklist from "../ResubmissionChecklist";
import DuplicateRejectionNotice from "../DuplicateRejectionNotice";
import DuplicateBusinessWarning from "../DuplicateBusinessWarning";

type ReviewSubmitStepProps = {
  application?: ApplicationDetailResponse | null;
  clusters: ClusterOption[];
  categories: CategoryOption[];
  onEditSection: (step: number) => void;
  isResubmission?: boolean;
  feedback: ApplicationFeedbackResponse[];
};

export default function ReviewSubmitStep({
  application = null,
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
        {isResubmission && application?.duplicate_disposition ? (
          <View className="px-6">
            <DuplicateRejectionNotice
              disposition={application.duplicate_disposition}
            />
          </View>
        ) : (
          <View className="w-full">
            <DuplicateBusinessWarning
              application={application}
              onReviewLocation={() => onEditSection(2)}
            />
          </View>
        )}

        {isResubmission && <ResubmissionChecklist feedback={feedback} />}

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
