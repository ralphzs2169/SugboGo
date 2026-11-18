import { API_ERROR_CODE } from "@/shared/constants/errorCodes";
import { API_ERROR_MESSAGE } from "@/shared/constants/errorMessages";
import type { ApiMessageResponse } from "@/shared/types/apiResponse.types";
import { createApiError } from "@/shared/utils/apiErrors";

import { request } from "../request.service";

describe("request error messages", () => {
  it.each([
    ["AUTH_ERROR", "SESSION_EXPIRED"],
    ["NETWORK_ERROR", "NETWORK_ERROR"],
    ["REQUEST_TIMEOUT", "REQUEST_TIMEOUT"],
    ["UNKNOWN_ERROR", "UNKNOWN_ERROR"],
  ] as const)("normalizes %s to a displayable message", async (error, code) => {
    await expect(
      request<ApiMessageResponse>(
        Promise.reject(createApiError(API_ERROR_CODE[error])),
      ),
    ).resolves.toEqual({
      success: false,
      code,
      message: API_ERROR_MESSAGE[error].text1,
    });
  });
});
