import { act, fireEvent, render } from "@testing-library/react-native";
import useUserLocation from "@/shared/hooks/useUserLocation";
import { recordRoutePlanningIntent } from "../../api/routePlanningIntent.service";
import useRoadRoute from "../../hooks/useRoadRoute";
import useDirectJourneys from "../../hooks/useDirectJourneys";
import { useJourneyOriginStore } from "../../stores/journeyOrigin.store";
import RoadRouteScreen from "../RoadRouteScreen";
import JeepneyGuideScreen from "../JeepneyGuideScreen";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
  useSafeAreaInsets: () => ({ top: 0, left: 0, bottom: 0, right: 0 }),
}));
jest.mock("@/shared/hooks/useQueryErrorNotification", () => () => {});
jest.mock("@/shared/hooks/useUserLocation");
jest.mock("../../api/routePlanningIntent.service", () => ({
  recordRoutePlanningIntent: jest.fn(),
}));
jest.mock("../../hooks/useRoadRoute");
jest.mock("../../hooks/useDirectJourneys");
jest.mock("../../hooks/useExploreBusinessProfile", () => ({
  __esModule: true,
  default: () => ({
    business: {
      id: 21,
      business_name: "Destination",
      location: { address: "Cebu", latitude: 10.3, longitude: 123.9 },
    },
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));
jest.mock("../../components/getting-there/RoadRouteMap", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock(
  "../../components/getting-there/road-route/RoadRouteContextCard",
  () => ({ __esModule: true, default: () => null }),
);
jest.mock(
  "../../components/getting-there/road-route/RoadRouteGuidanceCard",
  () => ({ __esModule: true, default: () => null }),
);
jest.mock(
  "../../components/getting-there/road-route/RoadRouteMapSkeleton",
  () => ({ __esModule: true, default: () => null }),
);
jest.mock("../../components/getting-there/LocationUnavailableState", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("../../components/getting-there/GettingThereLoadingState", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("../../components/getting-there/GettingThereEmptyState", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock(
  "../../components/getting-there/jeepney-guidance/JeepneyDestinationHeader",
  () => ({ __esModule: true, default: () => null }),
);
jest.mock(
  "../../components/getting-there/jeepney-guidance/JeepneyDestinationStickyHeader",
  () => ({ __esModule: true, default: () => null }),
);
jest.mock(
  "../../components/getting-there/jeepney-guidance/DirectJourneyList",
  () => ({ __esModule: true, default: () => null }),
);
jest.mock(
  "../../components/getting-there/jeepney-guidance/JourneyOriginSelector",
  () => ({ __esModule: true, default: () => null }),
);

describe("guidance calculations never generate route intent", () => {
  const refetch = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    useJourneyOriginStore.setState({ businessId: null, confirmedOrigin: null });
    jest.mocked(useUserLocation).mockReturnValue({
      status: "available",
      location: null,
      error: null,
      latitude: 10.3,
      longitude: 123.9,
      accuracy: 5,
      refreshLocation: jest.fn(),
      isRefreshingLocation: false,
    });
  });

  it("does not track Road Route mounting, Retry, location changes or rerender", async () => {
    jest.mocked(useRoadRoute).mockReturnValue({
      result: null,
      route: null,
      isLoading: false,
      error: new Error("Offline"),
      refetch,
    } as unknown as ReturnType<typeof useRoadRoute>);
    const screen = await render(<RoadRouteScreen businessId={21} />);
    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    jest.mocked(useUserLocation).mockReturnValue({
      status: "available",
      location: null,
      error: null,
      latitude: 10.31,
      longitude: 123.91,
      accuracy: 5,
      refreshLocation: jest.fn(),
      isRefreshingLocation: false,
    });
    await screen.rerender(<RoadRouteScreen businessId={21} />);
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(recordRoutePlanningIntent).not.toHaveBeenCalled();
  });

  it("does not track Jeepney mounting, Retry, confirmed-origin changes or rerender", async () => {
    jest.mocked(useDirectJourneys).mockReturnValue({
      result: null,
      routeOptions: [],
      reason: null,
      isLoading: false,
      error: new Error("Offline"),
      refetch,
    } as unknown as ReturnType<typeof useDirectJourneys>);
    const screen = await render(<JeepneyGuideScreen businessId={21} />);
    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    await act(async () =>
      useJourneyOriginStore.getState().confirmOrigin(21, {
        type: "selected",
        latitude: 10.4,
        longitude: 123.8,
        label: "Chosen origin",
      }),
    );
    await screen.rerender(<JeepneyGuideScreen businessId={21} />);
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(recordRoutePlanningIntent).not.toHaveBeenCalled();
  });
});
