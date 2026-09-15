import apiClient from "@/shared/api/apiClient.service";

import { getRoadRoute } from "../roadRoute.service";

jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

describe("Road route transport", () => {
  it("uses the Explorer endpoint with the current location snapshot", async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: {
        success: true,
        data: {
          route: null,
        },
      },
    });

    await getRoadRoute(21, 10.123, 123.456);

    expect(apiClient.get).toHaveBeenCalledWith(
      "/explorer/explore/businesses/21/road-route/",
      {
        params: {
          latitude: 10.123,
          longitude: 123.456,
        },
      },
    );
  });
});
