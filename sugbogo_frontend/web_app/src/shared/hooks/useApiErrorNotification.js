// shared/hooks/useApiErrorToast.js

import { useEffect } from "react";
import toast from "react-hot-toast";

/**
 * Displays a deduplicated user-facing notification when an API request fails
 * and dismisses the notification when the error is resolved.
 */
export default function useApiErrorNotification(
  error,
  { toastId, fallbackMessage = "Something went wrong. Please try again." },
) {
  useEffect(() => {
    if (!error) {
      toast.dismiss(toastId);
      return;
    }

    toast.error(error.response?.data?.message || fallbackMessage, {
      id: toastId,
    });
  }, [error, toastId, fallbackMessage]);
}
