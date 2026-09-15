import { fireEvent, render } from "@testing-library/react-native";

import useUserLocation from "@/shared/hooks/useUserLocation";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";

import useExploreBusinessProfile from "../../hooks/useExploreBusinessProfile";
import useRoadRoute from "../../hooks/useRoadRoute";
import RoadRouteScreen from "../RoadRouteScreen";

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
  },
}));
jest.mock("@/shared/hooks/useUserLocation");
jest.mock("@/shared/hooks/useQueryErrorNotification", () => jest.fn());
jest.mock("../../hooks/useExploreBusinessProfile");
jest.mock("../../hooks/useRoadRoute");
jest.mock(
  "../../components/getting-there/RoadRouteMap",
  () =>
    function MockRoadRouteMap() {
      const { Text } = jest.requireActual("react-native");
      return <Text>Road-following route map</Text>;
    },
);

const businessRefetch = jest.fn();
const routeRefetch = jest.fn();

describe("RoadRouteScreen", () => {
  beforeEach(() => {
    (useExploreBusinessProfile as jest.Mock).mockReturnValue({
      business: {
        business_name: "Sugbo Cafe",
      },
      isLoading: false,
      error: null,
      refetch: businessRefetch,
    });
    (useUserLocation as jest.Mock).mockReturnValue({
      status: "available",
      latitude: 10.123,
      longitude: 123.456,
      isRefreshingLocation: false,
      refreshLocation: jest.fn(),
    });
  });

  it("keeps a route-specific loading state visible", async () => {
    (useRoadRoute as jest.Mock).mockReturnValue({
      result: null,
      route: null,
      isLoading: true,
      error: null,
      refetch: routeRefetch,
    });

    const screen = await render(<RoadRouteScreen businessId={21} />);

    expect(screen.getByText("Loading the road route…")).toBeTruthy();
  });

  it("shows the normalized road route summary and map", async () => {
    (useRoadRoute as jest.Mock).mockReturnValue({
      result: {
        route: {},
      },
      route: {
        distance_meters: 5800,
        duration_seconds: 1080,
        encoded_polyline: "encoded-road-route",
        origin: {
          latitude: 10.123,
          longitude: 123.456,
        },
        destination: {
          latitude: 10.789,
          longitude: 123.987,
        },
      },
      isLoading: false,
      error: null,
      refetch: routeRefetch,
    });

    const screen = await render(<RoadRouteScreen businessId={21} />);

    expect(screen.getByText("Sugbo Cafe")).toBeTruthy();
    expect(screen.getByText("5.8 km")).toBeTruthy();
    expect(screen.getByText("18 min")).toBeTruthy();
    expect(screen.getByText("Road-following route map")).toBeTruthy();
    expect(screen.getByText(/does not include live traffic/)).toBeTruthy();
  });

  it("shows a location-specific state before querying a route", async () => {
    (useUserLocation as jest.Mock).mockReturnValue({
      status: "denied",
      latitude: null,
      longitude: null,
      isRefreshingLocation: false,
      refreshLocation: jest.fn(),
    });
    (useRoadRoute as jest.Mock).mockReturnValue({
      result: null,
      route: null,
      isLoading: false,
      error: null,
      refetch: routeRefetch,
    });

    const screen = await render(<RoadRouteScreen businessId={21} />);

    expect(screen.getByText("Location needed")).toBeTruthy();
    expect(screen.getByText(/show the road route/)).toBeTruthy();
    expect(useRoadRoute).toHaveBeenCalledWith(21, null, null);
  });

  it("renders a successful no-route state", async () => {
    (useRoadRoute as jest.Mock).mockReturnValue({
      result: {
        route: null,
      },
      route: null,
      isLoading: false,
      error: null,
      refetch: routeRefetch,
    });

    const screen = await render(<RoadRouteScreen businessId={21} />);

    expect(screen.getByText("No road route available")).toBeTruthy();
  });

  it("keeps an API failure visible and retries through React Query", async () => {
    const error = new Error("route unavailable");
    (useRoadRoute as jest.Mock).mockReturnValue({
      result: null,
      route: null,
      isLoading: false,
      error,
      refetch: routeRefetch,
    });

    const screen = await render(<RoadRouteScreen businessId={21} />);

    expect(screen.getByText("Unable to load road route")).toBeTruthy();
    fireEvent.press(screen.getByText("Retry"));
    expect(routeRefetch).toHaveBeenCalled();
    expect(useQueryErrorNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        error,
        toastId: "road-route-error",
      }),
    );
  });
});
