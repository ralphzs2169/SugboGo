import { createContext } from "react";

import { API_ERROR_CODE } from "@/shared/api/errorCodes";

export const PageLoadContext = createContext(null);

export function isConnectionFailure(error) {
  const code = error?.response?.data?.code;
  return (
    code === API_ERROR_CODE.NETWORK_ERROR ||
    code === API_ERROR_CODE.REQUEST_TIMEOUT
  );
}
