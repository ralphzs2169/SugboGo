import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";

import * as service from "../businessNameChange.service";

jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock("@/shared/api/request.service", () => ({
  request: jest.fn(async (value) => value),
}));

describe("businessNameChange.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.get as jest.Mock).mockResolvedValue({ success: true, data: {} });
    (apiClient.post as jest.Mock).mockResolvedValue({
      success: true,
      data: {},
    });
  });

  it("uses focused submit, paginated history, detail, and withdraw routes", async () => {
    await service.submitBusinessNameChange({
      proposed_business_name: "Sugbo Heritage Bistro",
    });
    await service.getBusinessNameChangeRequests(2);
    await service.getBusinessNameChangeRequest(7);
    await service.withdrawBusinessNameChange(7);

    expect(apiClient.post).toHaveBeenCalledWith(
      "/merchant/business-profile/update-requests/business-name/",
      { proposed_business_name: "Sugbo Heritage Bistro" },
    );
    expect(apiClient.get).toHaveBeenCalledWith(
      "/merchant/business-profile/update-requests/",
      { params: { page: 2 } },
    );
    expect(apiClient.get).toHaveBeenCalledWith(
      "/merchant/business-profile/update-requests/7/",
    );
    expect(apiClient.post).toHaveBeenCalledWith(
      "/merchant/business-profile/update-requests/7/withdraw/",
    );
    expect(request).toHaveBeenCalledTimes(4);
  });
});
