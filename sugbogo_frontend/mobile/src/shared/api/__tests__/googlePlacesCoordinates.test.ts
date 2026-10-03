import apiClient from "../apiClient.service";
import { reverseGeocode } from "../googlePlaces.service";

jest.mock("../apiClient.service", () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));
jest.mock("../request.service", () => ({
  request: jest.fn((value) => value),
}));

describe("business reverse-geocode request coordinates", () => {
  it("sends Business 1's persisted latitude and longitude in HTTP order", async () => {
    const latitude = 10.299255281007682;
    const longitude = 123.90291843563318;
    (apiClient.post as jest.Mock).mockResolvedValue({ success: true });

    await reverseGeocode(latitude, longitude);

    expect(apiClient.post).toHaveBeenCalledWith(
      "/merchant/application/reverse-geocode/",
      { latitude, longitude },
    );
  });
});
