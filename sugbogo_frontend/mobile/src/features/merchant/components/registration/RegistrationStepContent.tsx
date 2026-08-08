import useRegistrationErrorScroll from "../../hooks/registration/useRegistrationErrorScroll";
import BusinessIdentityStep from "./steps/BusinessIdentityStep";
import BusinessLocationStep from "./steps/BusinessLocationStep";
import BusinessPhotosStep from "./steps/BusinessPhotosStep";
import OperatingHoursStep from "./steps/OperatingHoursStep";
import ReviewSubmitStep from "./steps/ReviewSubmitStep";
import VerificationDocumentsStep from "./steps/VerificationDocumentsStep";

import type {
  CategoryOption,
  ClusterOption,
} from "@/features/merchant/types/registration/registrationOption.types";
import type { ApplicationFeedbackResponse } from "@/features/merchant/types/registration/registrationApi.types";
import { ApiError } from "@/shared/types/apiResponse.types";

type RegistrationStepContentProps = {
  currentStep: number;
  clusters: ClusterOption[];
  categories: CategoryOption[];
  isLoadingClusters: boolean;
  isLoadingCategories: boolean;
  clustersError: ApiError | null;
  categoriesError: ApiError | null;
  refetchClusters: () => void;
  refetchCategories: () => void;
  onEditSection: (step: number) => void;
  isResubmission: boolean;
  feedback: ApplicationFeedbackResponse[];
  registerErrorScrollTarget: ReturnType<
    typeof useRegistrationErrorScroll
  >["registerErrorScrollTarget"];
};

export default function RegistrationStepContent({
  currentStep,
  clusters,
  categories,
  isLoadingClusters,
  isLoadingCategories,
  clustersError,
  categoriesError,
  refetchClusters,
  refetchCategories,
  onEditSection,
  isResubmission,
  feedback,
  registerErrorScrollTarget,
}: RegistrationStepContentProps) {
  switch (currentStep) {
    case 1:
      return (
        <BusinessIdentityStep
          clusters={clusters}
          categories={categories}
          isLoadingClusters={isLoadingClusters}
          isLoadingCategories={isLoadingCategories}
          clustersError={clustersError}
          categoriesError={categoriesError}
          refetchClusters={refetchClusters}
          refetchCategories={refetchCategories}
          registerErrorScrollTarget={registerErrorScrollTarget}
        />
      );

    case 2:
      return (
        <BusinessLocationStep
          registerErrorScrollTarget={registerErrorScrollTarget}
        />
      );

    case 3:
      return (
        <OperatingHoursStep
          registerErrorScrollTarget={registerErrorScrollTarget}
        />
      );

    case 4:
      return (
        <BusinessPhotosStep
          registerErrorScrollTarget={registerErrorScrollTarget}
        />
      );

    case 5:
      return (
        <VerificationDocumentsStep
          registerErrorScrollTarget={registerErrorScrollTarget}
        />
      );

    case 6:
      return (
        <ReviewSubmitStep
          clusters={clusters}
          categories={categories}
          onEditSection={onEditSection}
          isResubmission={isResubmission}
          feedback={feedback}
        />
      );

    default:
      return null;
  }
}
