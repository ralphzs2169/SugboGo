import BusinessIdentityStep from "./steps/BusinessIdentityStep";
import BusinessLocationStep from "./steps/BusinessLocationStep";
import OperatingHoursStep from "./steps/OperatingHoursStep";
import BusinessPhotosStep from "./steps/BusinessPhotosStep";
import VerificationDocumentsStep from "./steps/VerificationDocumentsStep";
import ReviewSubmitStep from "./steps/ReviewSubmitStep";

import type {
  ClusterOption,
  CategoryOption,
} from "@/features/merchant/types/merchantRegistration.types";
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
        />
      );

    case 2:
      return <BusinessLocationStep />;

    case 3:
      return <OperatingHoursStep />;

    case 4:
      return <BusinessPhotosStep />;

    case 5:
      return <VerificationDocumentsStep />;

    case 6:
      return (
        <ReviewSubmitStep
          clusters={clusters}
          categories={categories}
          onEditSection={onEditSection}
        />
      );

    default:
      return null;
  }
}
