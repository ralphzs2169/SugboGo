import { fireEvent, render } from "@testing-library/react-native";

import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import useUserLocation from "@/shared/hooks/useUserLocation";

import useDirectJourneyMap from "../../hooks/useDirectJourneyMap";
import useExploreBusinessProfile from "../../hooks/useExploreBusinessProfile";
import { useJourneyOriginStore } from "../../stores/journeyOrigin.store";
import type { DirectJourneyMapGuidance } from "../../types/directJourney.types";
import JeepneyRouteMapScreen from "../JeepneyRouteMapScreen";

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
  },
}));
jest.mock("@/shared/hooks/useUserLocation");
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("@/shared/hooks/useQueryErrorNotification", () => jest.fn());
jest.mock("../../hooks/useDirectJourneyMap");
jest.mock("../../hooks/useExploreBusinessProfile");
jest.mock(
  "../../components/getting-there/JeepneyRouteMap",
  () =>
    function MockJeepneyRouteMap({
      originMarkerLabel,
      originMarkerTitle,
    }: {
      originMarkerLabel: string;
      originMarkerTitle: string;
    }) {
      const { Text } = jest.requireActual("react-native");
      return (
        <>
          <Text>Selected journey map</Text>
          <Text>{originMarkerLabel}</Text>
          <Text>{originMarkerTitle}</Text>
        </>
      );
    },
);

const refetch = jest.fn();
const journey: DirectJourneyMapGuidance = {
  jeepney_route_code: "14D",
  route_variant: {
    id: 8,
    origin: { id: 1, name: "Kamputhaw" },
    destination: { id: 4, name: "Colon" },
  },
  boarding_transit_point: {
    id: 2,
    name: "Capitol",
    latitude: 10.3173,
    longitude: 123.8908,
    sequence: 2,
  },
  alighting_transit_point: {
    id: 4,
    name: "Colon",
    latitude: 10.294,
    longitude: 123.9003,
    sequence: 4,
  },
  ride: {
    approximate_distance_meters: 3438.7,
    full_variant_geometry: [
      { latitude: 10.32, longitude: 123.88 },
      { latitude: 10.294, longitude: 123.9003 },
    ],
    selected_segment_geometry: [
      { latitude: 10.3173, longitude: 123.8908 },
      { latitude: 10.294, longitude: 123.9003 },
    ],
  },
  business_location: {
    latitude: 10.2935,
    longitude: 123.901,
  },
  landmark_context: {
    id: 12,
    name: "Gaisano Capital South",
    distance_from_alighting_meters: 85,
  },
};

describe("JeepneyRouteMapScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useJourneyOriginStore.setState({
      businessId: null,
      confirmedOrigin: null,
    });
    (useUserLocation as jest.Mock).mockReturnValue({
      status: "available",
      location: {
        coords: {
          latitude: 10.3,
          longitude: 123.88,
        },
      },
      latitude: 10.3,
      longitude: 123.88,
      isRefreshingLocation: false,
      refreshLocation: jest.fn(),
    });
    (useExploreBusinessProfile as jest.Mock).mockReturnValue({
      business: { business_name: "Sugbo Cafe" },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    (useDirectJourneyMap as jest.Mock).mockReturnValue({
      result: { journey },
      journey,
      isLoading: false,
      error: null,
      refetch,
    });
  });

  it("loads and presents the selected journey map context", async () => {
    const screen = await render(
      <JeepneyRouteMapScreen
        businessId={21}
        routeVariantId={8}
        boardingTransitPointId={2}
        alightingTransitPointId={4}
      />,
    );

    expect(useDirectJourneyMap).toHaveBeenCalledWith(21, 8, 2, 4);
    expect(screen.getByText("Selected journey map")).toBeTruthy();
    expect(screen.getByText("14D")).toBeTruthy();
    expect(screen.getByText("Kamputhaw → Colon")).toBeTruthy();
    expect(screen.getByText("Capitol")).toBeTruthy();
    expect(screen.getByText("Colon")).toBeTruthy();
    expect(screen.getByText("Near Gaisano Capital South")).toBeTruthy();
    expect(screen.getAllByText("Current location")).toHaveLength(2);
  });

  it("uses and labels the confirmed manual journey origin", async () => {
    useJourneyOriginStore.setState({
      businessId: 21,
      confirmedOrigin: {
        type: "selected",
        latitude: 10.318,
        longitude: 123.904,
        label: "Ayala Center Cebu",
      },
    });

    const screen = await render(
      <JeepneyRouteMapScreen
        businessId={21}
        routeVariantId={8}
        boardingTransitPointId={2}
        alightingTransitPointId={4}
      />,
    );

    expect(screen.getByText("Starting point")).toBeTruthy();
    expect(screen.getByText("Ayala Center Cebu")).toBeTruthy();
  });

  it("shows a persistent map error and retries its React Query request", async () => {
    const error = new Error("map unavailable");
    (useDirectJourneyMap as jest.Mock).mockReturnValue({
      result: null,
      journey: null,
      isLoading: false,
      error,
      refetch,
    });

    const screen = await render(
      <JeepneyRouteMapScreen
        businessId={21}
        routeVariantId={8}
        boardingTransitPointId={2}
        alightingTransitPointId={4}
      />,
    );

    expect(screen.getByText("Unable to load jeepney route")).toBeTruthy();
    fireEvent.press(screen.getByText("Retry"));
    expect(refetch).toHaveBeenCalled();
    expect(useQueryErrorNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        error,
        toastId: "direct-journey-map-error",
      }),
    );
  });
});
