import apiClient from "@/shared/api/apiClient.service";

import {
  getDirectJourneyMap,
  getDirectJourneys,
} from "../directJourney.service";

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
          route_options: [],
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

  it("uses selected journey IDs for map guidance", async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: {
        success: true,
        data: {
          journey: {},
        },
      },
    });

    await getDirectJourneyMap(21, 8, 2, 4);

    expect(apiClient.get).toHaveBeenCalledWith(
      "/explorer/explore/businesses/21/direct-journeys/map/",
      {
        params: {
          route_variant_id: 8,
          boarding_transit_point_id: 2,
          alighting_transit_point_id: 4,
        },
      },
    );
  });
});
