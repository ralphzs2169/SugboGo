import axios from "axios";

import { API_ERROR_CODE } from "../constants/errorCodes";

/** Separates transport failures from server decisions when preserving an existing session. */
export function isTransportError(error: unknown): boolean {
  return (
    (error instanceof Error &&
      (error.name === API_ERROR_CODE.NETWORK_ERROR ||
        error.name === API_ERROR_CODE.REQUEST_TIMEOUT)) ||
    (axios.isAxiosError(error) &&
      !error.response &&
      error.code !== "ERR_CANCELED")
  );
}
