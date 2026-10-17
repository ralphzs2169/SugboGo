import apiClient from "@/shared/api/apiClient.service";

import {
  analyticsSuccess,
  standardAnalyticsReport,
} from "../../__tests__/merchantAnalytics.fixtures";
import { getMerchantStandardAnalytics } from "../merchantAnalytics.service";

jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

describe("merchant Standard analytics transport", () => {
  it.each(["7", "30", "90"] as const)(
    "sends only the supported period %s and preserves the envelope",
    async (period) => {
      const response = analyticsSuccess(
        standardAnalyticsReport({ profile_visits: null }),
      );
      jest.mocked(apiClient.get).mockResolvedValue({ data: response });

      await expect(getMerchantStandardAnalytics(period)).resolves.toEqual(
        response,
      );

      expect(apiClient.get).toHaveBeenCalledWith(
        "/merchant/analytics/standard/",
        {
          params: { period },
        },
      );
    },
  );
});
