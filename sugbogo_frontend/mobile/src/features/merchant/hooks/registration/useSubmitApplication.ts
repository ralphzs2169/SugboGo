import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";
import Toast from "react-native-toast-message";

import type { ApiError } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { submitApplication } from "../../api/merchantApplication.service";
import type {
  ApplicationSubmissionResponse,
} from "../../types/registration/registrationApi.types";

/**
 * Handles final merchant application submission.
 *
 * Exposes the submission state and submits the application only
 * after the backend has validated that every required step has
 * been completed.
 */
export default function useSubmitApplication() {
  const submissionInFlight = useRef(false);

  const mutation = useMutation<ApplicationSubmissionResponse, ApiError, void>({
    mutationFn: async () => {
      const response = await submitApplication();

      return throwOnApiError(response);
    },
  });

  const submit = async () => {
    if (submissionInFlight.current) {
      return {
        success: false,
      };
    }

    submissionInFlight.current = true;

    try {
      const data = await mutation.mutateAsync();

      return {
        success: true,
        data,
      };
    } catch (error) {
      const response = error as ApiError;

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
    } finally {
      submissionInFlight.current = false;
    }
  };

  return {
    submit,
    isSubmitting: mutation.isPending,
    error: mutation.error,
  };
}
