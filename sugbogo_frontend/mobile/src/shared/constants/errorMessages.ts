export const API_ERROR_MESSAGE = {
  AUTH_ERROR: {
    text1: "Session expired.",
    text2: "Please log in again.",
  },
  NETWORK_ERROR: {
    text1: "No internet connection.",
    text2: "Please check your connection and try again.",
  },
  REQUEST_TIMEOUT: {
    text1: "Request timed out.",
    text2: "Please try again.",
  },
  UNKNOWN_ERROR: {
    text1: "Something went wrong.",
    text2: "Please try again later.",
  },
} as const;
