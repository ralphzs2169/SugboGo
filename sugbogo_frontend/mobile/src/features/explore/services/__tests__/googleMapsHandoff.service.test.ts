import * as Linking from "expo-linking";

import {
  buildGoogleMapsDirectionsUrl,
  openGoogleMapsDirections,
} from "../googleMapsHandoff.service";

jest.mock("expo-linking", () => ({
  canOpenURL: jest.fn(),
  openURL: jest.fn(),
}));

const destination = {
  latitude: 10.789,
  longitude: 123.987,
};

describe("Google Maps road-route handoff", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("builds an origin-free driving directions URL", () => {
    const url = buildGoogleMapsDirectionsUrl(destination);

    expect(url).toBe(
      "https://www.google.com/maps/dir/?api=1" +
        "&destination=10.789,123.987" +
        "&travelmode=driving" +
        "&dir_action=navigate",
    );
    expect(url).not.toContain("origin=");
  });

  it("opens the supported Google Maps directions URL", async () => {
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);
    (Linking.openURL as jest.Mock).mockResolvedValue(true);

    await expect(openGoogleMapsDirections(destination)).resolves.toBe(
      "opened",
    );

    const expectedUrl = buildGoogleMapsDirectionsUrl(destination);
    expect(Linking.canOpenURL).toHaveBeenCalledWith(expectedUrl);
    expect(Linking.openURL).toHaveBeenCalledWith(expectedUrl);
  });

  it("reports unavailable without attempting to open the URL", async () => {
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(false);

    await expect(openGoogleMapsDirections(destination)).resolves.toBe(
      "unavailable",
    );
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it("safely normalizes an external-link failure", async () => {
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);
    (Linking.openURL as jest.Mock).mockRejectedValue(
      new Error("Unable to open browser"),
    );

    await expect(openGoogleMapsDirections(destination)).resolves.toBe(
      "failed",
    );
  });
});
