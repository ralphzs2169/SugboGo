import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";

import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import useUserLocation from "@/shared/hooks/useUserLocation";

import useDirectJourneys from "../../hooks/useDirectJourneys";
import useExploreBusinessProfile from "../../hooks/useExploreBusinessProfile";
import { useJourneyOriginStore } from "../../stores/journeyOrigin.store";
import type { DirectJourney } from "../../types/directJourney.types";
import JeepneyGuideScreen from "../JeepneyGuideScreen";

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
  },
}));
jest.mock("@/shared/hooks/useUserLocation");
jest.mock("@/shared/hooks/useQueryErrorNotification", () => jest.fn());
jest.mock("../../hooks/useDirectJourneys");
jest.mock("../../hooks/useExploreBusinessProfile");

const businessRefetch = jest.fn();
const journeyRefetch = jest.fn();
const refreshLocation = jest.fn();

const journey: DirectJourney = {
  journey_type: "direct",
  jeepney_route_code: "14D",
  route_variant_id: 8,
  route_variant_origin: { id: 1, name: "Kamputhaw" },
  route_variant_destination: { id: 4, name: "Colon" },
  boarding_transit_point: {
    id: 2,
    name: "Capitol",
    latitude: 10.3173,
    longitude: 123.8908,
  },
  boarding_sequence: 2,
  explorer_to_boarding_distance_meters: 180,
  alighting_transit_point: {
    id: 4,
    name: "Colon",
    latitude: 10.294,
    longitude: 123.9003,
  },
  alighting_sequence: 4,
  alighting_to_business_distance_meters: 220,
  total_access_egress_distance_meters: 400,
  approximate_ride_distance_meters: 3438.7291,
  landmark_context: {
    id: 12,
    name: "Gaisano Capital South",
    distance_from_alighting_meters: 85,
  },
};

function mockJourneyQuery(
  overrides: Partial<ReturnType<typeof useDirectJourneys>> = {},
) {
  (useDirectJourneys as jest.Mock).mockReturnValue({
    result: {
      route_options: [],
      reason: "no_direct_route_match",
    },
    routeOptions: [],
    reason: "no_direct_route_match",
    isLoading: false,
    error: null,
    refetch: journeyRefetch,
    ...overrides,
  });
}

describe("JeepneyGuideScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useJourneyOriginStore.setState({
      businessId: null,
      confirmedOrigin: null,
    });
    (useExploreBusinessProfile as jest.Mock).mockReturnValue({
      business: { business_name: "Sugbo Cafe" },
      isLoading: false,
      error: null,
      refetch: businessRefetch,
    });
    (useUserLocation as jest.Mock).mockReturnValue({
      status: "available",
      latitude: 10.3,
      longitude: 123.88,
      isRefreshingLocation: false,
      refreshLocation,
    });
    mockJourneyQuery();
  });

  it("shows location loading separately from journey loading", async () => {
    (useUserLocation as jest.Mock).mockReturnValue({
      status: "loading",
      latitude: null,
      longitude: null,
      isRefreshingLocation: true,
      refreshLocation,
    });

    const screen = await render(<JeepneyGuideScreen businessId={21} />);

    expect(screen.getByText("Finding your current location…")).toBeTruthy();
    expect(useDirectJourneys).toHaveBeenCalledWith(21, null, null);
  });

  it("shows a location-specific state when permission is denied", async () => {
    (useUserLocation as jest.Mock).mockReturnValue({
      status: "denied",
      latitude: null,
      longitude: null,
      isRefreshingLocation: false,
      refreshLocation,
    });

    const screen = await render(<JeepneyGuideScreen businessId={21} />);

    expect(screen.getByText("Location needed")).toBeTruthy();
    expect(screen.getByText("Choose starting point")).toBeTruthy();
    fireEvent.press(screen.getByText("Try Again"));
    expect(refreshLocation).toHaveBeenCalled();
  });

  it("opens the full-screen starting-point picker", async () => {
    const screen = await render(<JeepneyGuideScreen businessId={21} />);

    fireEvent.press(screen.getByText("Change"));

    expect(router.push).toHaveBeenCalledWith({
      pathname:
        "/(explorer)/business/[businessId]/jeepney-starting-point",
      params: {
        businessId: "21",
      },
    });
  });

  it("uses a confirmed manual origin for recommendations", async () => {
    useJourneyOriginStore.setState({
      businessId: 21,
      confirmedOrigin: {
        type: "selected",
        latitude: 10.318,
        longitude: 123.904,
        label: "Ayala Center Cebu",
      },
    });

    const screen = await render(<JeepneyGuideScreen businessId={21} />);

    expect(screen.getByText("Ayala Center Cebu")).toBeTruthy();
    expect(useDirectJourneys).toHaveBeenCalledWith(21, 10.318, 123.904);
  });

  it("keeps the journey loading state visible after location is available", async () => {
    mockJourneyQuery({ result: null, isLoading: true });

    const screen = await render(<JeepneyGuideScreen businessId={21} />);

    expect(screen.getByText("Checking direct jeepney routes…")).toBeTruthy();
  });

  it("renders the recommended journey and optional landmark in backend order", async () => {
    mockJourneyQuery({
      result: {
        route_options: [
          {
            jeepney_route_code: "14D",
            recommended_journey: journey,
            alternative_journeys: [],
          },
        ],
        reason: null,
      },
      routeOptions: [
        {
          jeepney_route_code: "14D",
          recommended_journey: journey,
          alternative_journeys: [],
        },
      ],
      reason: null,
    });

    const screen = await render(<JeepneyGuideScreen businessId={21} />);

    expect(screen.getByText("Recommended")).toBeTruthy();
    expect(screen.getByText("14D")).toBeTruthy();
    expect(screen.getByText("Kamputhaw → Colon")).toBeTruthy();
    expect(screen.getByText("Get off at Colon")).toBeTruthy();
    expect(screen.getByText(/Near Gaisano Capital South/)).toBeTruthy();
    expect(useDirectJourneys).toHaveBeenCalledWith(21, 10.3, 123.88);
  });

  it("navigates to map guidance with only the selected journey IDs", async () => {
    mockJourneyQuery({
      result: {
        route_options: [
          {
            jeepney_route_code: "14D",
            recommended_journey: journey,
            alternative_journeys: [],
          },
        ],
        reason: null,
      },
      routeOptions: [
        {
          jeepney_route_code: "14D",
          recommended_journey: journey,
          alternative_journeys: [],
        },
      ],
      reason: null,
    });

    const screen = await render(<JeepneyGuideScreen businessId={21} />);
    fireEvent.press(screen.getByText("View on map"));

    expect(router.push).toHaveBeenCalledWith({
      pathname:
        "/(explorer)/business/[businessId]/jeepney-route-map",
      params: {
        businessId: "21",
        routeVariantId: "8",
        boardingTransitPointId: "2",
        alightingTransitPointId: "4",
      },
    });
  });

  it("renders a successful no-route result without exposing its raw reason", async () => {
    const screen = await render(<JeepneyGuideScreen businessId={21} />);

    expect(screen.getByText("No convenient direct route found")).toBeTruthy();
    expect(screen.queryByText("no_direct_route_match")).toBeNull();
  });

  it("keeps an API failure visible and retries through React Query", async () => {
    const error = new Error("journey unavailable");
    mockJourneyQuery({ result: null, error });

    const screen = await render(<JeepneyGuideScreen businessId={21} />);

    expect(screen.getByText("Unable to load jeepney guidance")).toBeTruthy();
    fireEvent.press(screen.getByText("Retry"));
    expect(journeyRefetch).toHaveBeenCalled();
    expect(useQueryErrorNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        error,
        toastId: "direct-journeys-error",
      }),
    );
  });
});
