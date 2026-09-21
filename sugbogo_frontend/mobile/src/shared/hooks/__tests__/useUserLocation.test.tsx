import * as Location from "expo-location";
import { renderHook, waitFor } from "@testing-library/react-native";

import useUserLocation from "../useUserLocation";

jest.mock("expo-location", () => ({
  Accuracy: {
    High: 6,
  },
  PermissionStatus: {
    GRANTED: "granted",
  },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

describe("useUserLocation", () => {
  it("reports an available one-time location snapshot", async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "granted",
    });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: {
        latitude: 10.3,
        longitude: 123.88,
        accuracy: 20,
      },
    });

    const { result } = await renderHook(useUserLocation);

    await waitFor(() => expect(result.current.status).toBe("available"));

    expect(result.current.latitude).toBe(10.3);
    expect(result.current.longitude).toBe(123.88);
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({
      accuracy: Location.Accuracy.High,
    });
  });

  it("distinguishes denied permission from a location request failure", async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "denied",
    });

    const { result } = await renderHook(useUserLocation);

    await waitFor(() => expect(result.current.status).toBe("denied"));

    expect(result.current.location).toBeNull();
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });
});
