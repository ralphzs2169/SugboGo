import BusinessIdentityStep from "../../components/registration/steps/BusinessIdentityStep";
import BusinessLocationStep from "../../components/registration/steps/BusinessLocationStep";
import OperatingHoursStep from "../../components/registration/steps/OperatingHoursStep";
import BusinessPhotosStep from "../../components/registration/steps/BusinessPhotosStep";
import VerificationDocumentsStep from "../../components/registration/steps/VerificationDocumentsStep";
import ReviewSubmitStep from "../../components/registration/steps/ReviewSubmitStep";

export const REGISTRATION_STEPS = [
  {
    id: "identity",
    title: "Business Identity",
    component: BusinessIdentityStep,
  },
  {
    id: "location",
    title: "Business Location",
    component: BusinessLocationStep,
  },
  {
    id: "hours",
    title: "Operating Hours",
    component: OperatingHoursStep,
  },
  {
    id: "photos",
    title: "Business Photos",
    component: BusinessPhotosStep,
  },
  {
    id: "documents",
    title: "Verification Documents",
    component: VerificationDocumentsStep,
  },
  {
    id: "review",
    title: "Review & Submit",
    component: ReviewSubmitStep,
  },
];
