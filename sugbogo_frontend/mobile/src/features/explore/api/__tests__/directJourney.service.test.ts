import apiClient from "@/shared/api/apiClient.service";

import { getDirectJourneys } from "../directJourney.service";

jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

describe("Direct journey transport", () => {
  it("uses the Explorer endpoint with the current location snapshot", async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: {
        success: true,
        data: {
          journeys: [],
          reason: "no_direct_route_match",
        },
      },
    });

    await getDirectJourneys(21, 10.3, 123.88);

    expect(apiClient.get).toHaveBeenCalledWith(
      "/explorer/explore/businesses/21/direct-journeys/",
      {
        params: {
          latitude: 10.3,
          longitude: 123.88,
        },
      },
    );
  });
});
