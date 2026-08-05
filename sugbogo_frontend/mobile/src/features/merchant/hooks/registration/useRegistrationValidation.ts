import Toast from "react-native-toast-message";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";

import { merchantRegistrationSchema } from "../../validation/merchantRegistration.schema";

type MerchantRegistrationForm = z.input<typeof merchantRegistrationSchema>;

type UseRegistrationValidationProps = {
  currentStep: number;
  form: UseFormReturn<MerchantRegistrationForm>;
};

export default function useRegistrationValidation({
  currentStep,
  form,
}: UseRegistrationValidationProps) {
  const STEP_ONE_FIELDS = [
    "businessName",
    "businessCluster",
    "businessCategory",
    "businessDescription",
    "contactNumber",
    "specialtyTags",
    "businessEmail",
    "website",
    "representativeName",
    "representativeRole",
  ] as const;

  const validateCurrentStep = async () => {
    if (currentStep === 1) {
      const isValid = await form.trigger(STEP_ONE_FIELDS);

      if (!isValid) {
        Toast.show({
          type: "error",
          text1: "Incomplete business information",
          text2: "Please review the highlighted fields before continuing.",
        });
      }

      return isValid;
    }

    if (currentStep === 2) {
      const isValid = await form.trigger([
        "province",
        "city",
        "barangay",
        "streetAddress",
        "latitude",
        "longitude",
      ]);

      if (!isValid) {
        Toast.show({
          type: "error",
          text1: "Incomplete business location",
          text2:
            "Please select your business location and complete the address.",
        });
      }

      return isValid;
    }

    if (currentStep === 3) {
      const isValid = await form.trigger("operatingHours");

      if (!isValid) {
        const operatingHoursError = form.formState.errors.operatingHours;

        const hasNoOpenDaysError =
          operatingHoursError?.message === "At least one day must be open.";

        Toast.show({
          type: "error",
          text1: hasNoOpenDaysError
            ? "No operating days selected"
            : "Check your operating hours",
          text2: hasNoOpenDaysError
            ? "Please select at least one day that your business is open."
            : "Please review the highlighted days before continuing.",
        });
      }

      return isValid;
    }

    if (currentStep === 4) {
      const isValid = await form.trigger("businessPhotos");

      if (!isValid) {
        Toast.show({
          type: "error",
          text1: "Add a storefront photo",
          text2: "At least one storefront photo is required.",
        });
      }

      return isValid;
    }

    if (currentStep === 5) {
      const isValid = await form.trigger("verificationDocuments");

      if (!isValid) {
        Toast.show({
          type: "error",
          text1: "Verification document required",
          text2:
            "Please upload your business registration document before continuing.",
        });
      }

      return isValid;
    }

    return true;
  };

  return {
    validateCurrentStep,
  };
}
