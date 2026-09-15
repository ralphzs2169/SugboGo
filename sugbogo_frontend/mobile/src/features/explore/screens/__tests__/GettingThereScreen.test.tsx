import { render } from "@testing-library/react-native";

import useUserLocation from "@/shared/hooks/useUserLocation";

import useDirectJourneys from "../../hooks/useDirectJourneys";
import useExploreBusinessProfile from "../../hooks/useExploreBusinessProfile";
import GettingThereScreen from "../GettingThereScreen";

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
  },
}));
jest.mock("@/shared/hooks/useUserLocation");
jest.mock("@/shared/hooks/useApiErrorNotification", () => jest.fn());
jest.mock("../../hooks/useDirectJourneys");
jest.mock("../../hooks/useExploreBusinessProfile");

const refetch = jest.fn();

describe("GettingThereScreen", () => {
  beforeEach(() => {
    (useExploreBusinessProfile as jest.Mock).mockReturnValue({
      business: {
        business_name: "Sugbo Cafe",
      },
      isLoading: false,
      error: null,
      refetch,
    });
  });

  it("shows a location-specific state and withholds journey coordinates", async () => {
    (useUserLocation as jest.Mock).mockReturnValue({
      status: "denied",
      latitude: null,
      longitude: null,
      isRefreshingLocation: false,
      refreshLocation: jest.fn(),
    });
    (useDirectJourneys as jest.Mock).mockReturnValue({
      result: null,
      journeys: [],
      reason: null,
      isLoading: false,
      error: null,
      refetch,
    });

    const screen = await render(<GettingThereScreen businessId={21} />);

    expect(screen.getByText("Location needed")).toBeTruthy();
    expect(useDirectJourneys).toHaveBeenCalledWith(21, null, null);
  });

  it("renders a successful no-route result without exposing its raw reason", async () => {
    (useUserLocation as jest.Mock).mockReturnValue({
      status: "available",
      latitude: 10.3,
      longitude: 123.88,
      isRefreshingLocation: false,
      refreshLocation: jest.fn(),
    });
    (useDirectJourneys as jest.Mock).mockReturnValue({
      result: {
        journeys: [],
        reason: "no_direct_route_match",
      },
      journeys: [],
      reason: "no_direct_route_match",
      isLoading: false,
      error: null,
      refetch,
    });

    const screen = await render(<GettingThereScreen businessId={21} />);

    expect(screen.getByText("No convenient direct route found")).toBeTruthy();
    expect(screen.queryByText("no_direct_route_match")).toBeNull();
  });
});
