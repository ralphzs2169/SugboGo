import { useEffect } from "react";
import Toast from "react-native-toast-message";

import { API_ERROR_MESSAGE } from "@/shared/constants/errorMessages";
import type { ApiError } from "@/shared/types/apiResponse.types";

type Options = {
  error: unknown;
  toastId: string;
  title: string;
  fallbackMessage: string;
};

/** Shows one page-level toast when a query exposes a new API error. */
export default function useApiErrorNotification({
  error,
  toastId,
  title,
  fallbackMessage,
}: Options) {
  useEffect(() => {
    if (!error) {
      return;
    }

    const apiError = error as Partial<ApiError>;
    const configuredMessage =
      API_ERROR_MESSAGE[apiError.code as keyof typeof API_ERROR_MESSAGE];

    Toast.show({
      type: "error",
      text1: configuredMessage?.text1 ?? title,
      text2: configuredMessage?.text2 ?? apiError.message ?? fallbackMessage,
      props: {
        toastId,
      },
    });
  }, [error, fallbackMessage, title, toastId]);
}
