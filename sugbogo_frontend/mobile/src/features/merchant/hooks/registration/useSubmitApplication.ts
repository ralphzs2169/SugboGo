import { useState } from "react";

import { handleSystemError } from "@/shared/utils/apiErrors";
import Toast from "react-native-toast-message";
import { submitApplication } from "../../api/merchantApplication.service";

/**
 * Handles final merchant application submission.
 *
 * Exposes the submission state and submits the application only
 * after the backend has validated that every required step has
 * been completed.
 */
export default function useSubmitApplication() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    if (isSubmitting) {
      return {
        success: false,
      };
    }

    setIsSubmitting(true);

    try {
      const response = await submitApplication();

      if (!response.success) {
        if (handleSystemError(response)) {
          return {
            success: false,
          };
        }

        Toast.show({
          type: "error",
          text1: "Unable to submit application",
          text2:
            response.message ?? "Please review your application and try again.",
        });

        return {
          success: false,
        };
      }

      return {
        success: true,
        data: response.data,
      };
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    submit,
    isSubmitting,
  };
}
