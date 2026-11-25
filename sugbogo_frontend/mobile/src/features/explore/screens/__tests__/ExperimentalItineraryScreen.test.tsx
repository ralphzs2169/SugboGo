import JeepneyRouteContextCard from "../../components/getting-there/jeepney-guidance/jeep-guide-map/JeepneyRouteContextCard";
import { sharesTransferArea } from "../../components/getting-there/JourneyTimeline";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { openGoogleMapsWalkingDirections } from "../../services/googleMapsHandoff.service";

import ItineraryJourneyScreen from "../../screens/ItineraryJourneyScreen";
import { useItinerarySelectionStore } from "../../stores/itinerarySelection.store";
import { router } from "expo-router";
import JourneyRoute from "@/app/(explorer)/business/[businessId]/journey-map";
import BusinessLayout from "@/app/(explorer)/business/[businessId]/_layout";
import { BackHandler } from "react-native";
import {
  journeyLabels,
  accessPoint,
} from "../../components/getting-there/ExperimentalItineraryMap";
import ExperimentalItinerariesRoute from "@/app/(explorer)/business/[businessId]/experimental-itineraries";
import { useJourneyOriginStore } from "../../stores/journeyOrigin.store";

import {
  getExperimentalItinerary,
  searchExperimentalItineraries,
} from "../../api/experimentalItinerary.service";
import type {
  ItineraryAccess,
  ItineraryDetail,
  ItinerarySearchResult,
  ItineraryWalk,
  TransferLimit,
} from "../../types/experimentalItinerary.types";

jest.mock("expo-router", () => {
  const { Text } = require("react-native");
  return {
    Redirect: () => <Text>Experiment disabled</Text>,
    Stack: Object.assign(({ children }: any) => <>{children}</>, {
      Screen: (props: any) => (
        <Text
          testID={props.name ?? "route-screen-options"}
          options={props.options}
        />
      ),
    }),
    router: { push: jest.fn(), back: jest.fn() },
    useIsFocused: () => true,
    useLocalSearchParams: () => ({ businessId: "12" }),
  };
});
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: require("react-native").View,
  useSafeAreaInsets: () => ({ top: 24, bottom: 12, left: 0, right: 0 }),
}));
jest.mock("react-native-maps", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: require("react").forwardRef((props: any, ref: any) => {
      require("react").useImperativeHandle(ref, () => ({
        fitToCoordinates: mockFit,
        pointForCoordinate: async () => ({ x: 100, y: 100 }),
      }));
      return <View {...props} />;
    }),
    Marker: View,
    Polyline: View,
    PROVIDER_GOOGLE: "google",
  };
});
jest.mock("@/shared/hooks/useUserLocation", () => ({
  __esModule: true,
  default: () => ({ status: "available", ...mockDeviceLocation }),
}));
jest.mock("@/shared/components/AppText", () => require("react-native").Text);
jest.mock("@/shared/components/MapMarker", () => () => null);
jest.mock("@/shared/components/DottedTimelineConnector", () => () => null);
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("../../api/experimentalItinerary.service");
jest.mock("../../hooks/useBusinessDetailSource", () => ({
  __esModule: true,
  default: () => ({
    business: {
      business_name: "Fixture business",
      display_cover_photo_url: "https://example.com/business.jpg",
      location: { address: "Fixture address" },
    },
  }),
}));
jest.mock("../../services/googleMapsHandoff.service", () => ({
  openGoogleMapsWalkingDirections: jest.fn(),
}));

const mockFit = jest.fn();
jest.mock("@gorhom/bottom-sheet", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({ snapToIndex: jest.fn() }));
      return <View {...props} testID="persistent-sheet" />;
    }),
    BottomSheetScrollView: View,
  };
});

const origin = { latitude: 10.31, longitude: 123.9 };
let mockDeviceLocation = origin;
const destination = { latitude: 10.32, longitude: 123.95 };
const walk: ItineraryWalk = {
  from: origin,
  to: destination,
  status: "available",
  diagnostic_code: null,
  straight_line_distance_meters: 10,
  mapped_distance_meters: 80,
  duration_seconds: 60,
  encoded_polyline: "_p~iF~ps|U_ulLnnqC",
  provider_start: origin,
  provider_end: destination,
  source: "google_routes",
  warnings: ["Mocked warning"],
};
const access: ItineraryAccess = {
  route_position: { ...origin, fraction: 0.2 },
  access_coordinate: origin,
  coordinate_status: "provisional",
  permission: "unknown",
  passenger_location_verified: false,
  landmark: {
    name: "Sample hall",
    place_id: "place",
    address: "Sample road",
    location: destination,
    distance_meters: 20,
    source: "google_places",
    attributions: [{ name: "Local source", url: "https://example.com" }],
  },
};
const totals = {
  mapped_walking_distance_meters: 320,
  straight_line_walking_distance_meters: 90,
  ride_distance_meters: 3000,
  transfer_penalty_meters: 200,
  ranking_cost_meters: 520,
};

function detailFor(transferCount: TransferLimit): ItineraryDetail {
  return {
    business_id: 12,
    origin,
    destination,
    max_transfers: transferCount,
    rank: 1,
    transfer_count: transferCount,
    route_alignment_status: "unreviewed",
    passenger_access_verified: false,
    passenger_ready: false,
    has_blocking_evidence: false,
    access_walk: walk,
    egress_walk: walk,
    ride_legs: Array.from({ length: transferCount + 1 }, (_, index) => ({
      variant_id: index + 1,
      geometry_revision: "revision",
      route_code: `J${index + 1}`,
      route_alignment_status: "unreviewed",
      route_provenance: null,
      direction: { from: `Start ${index + 1}`, toward: `End ${index + 1}` },
      boarding: { ...access },
      alighting: { ...access },
      ride_distance_meters: 1000,
      geometry: [origin, destination],
    })),
    transfers: Array.from({ length: transferCount }, (_, index) => ({
      from_variant_id: index + 1,
      to_variant_id: index + 2,
      validation_status: "provisional",
      passenger_access_verified: false,
      passenger_ready: false,
      centerline_gap_meters: 5,
      alighting_route_fraction: 0.9,
      boarding_route_fraction: 0.1,
      walk,
    })),
    totals,
  };
}

function resultsFor(detail: ItineraryDetail): ItinerarySearchResult {
  return {
    business_id: detail.business_id,
    origin: detail.origin,
    destination: detail.destination,
    max_transfers: detail.max_transfers,
    reason: null,
    coverage: {
      incomplete_reason: null,
      variants_excluded_by_spatial_validation: 0,
      geometric_candidates_considered: 2,
      geometric_candidates_truncated: false,
      candidates_evaluated: 1,
      alternatives_unchecked: true,
      walking_checks_deferred: false,
    },
    options: [
      {
        ...totals,
        rank: 1,
        transfer_count: detail.transfer_count,
        route_alignment_status: detail.route_alignment_status,
        passenger_access_verified: detail.passenger_access_verified,
        passenger_ready: detail.passenger_ready,
        has_blocking_evidence: false,
        selection: "signed-selection",
        route_sequence: detail.ride_legs.map((ride) => ride.route_code),
        walking_statuses: ["available"],
      },
    ],
  };
}

function renderRoute() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ExperimentalItinerariesRoute />
    </QueryClientProvider>,
  );
}

const previousFlag = process.env.EXPO_PUBLIC_EXPERIMENTAL_ITINERARIES_ENABLED;
beforeEach(() => {
  mockDeviceLocation = origin;
  process.env.EXPO_PUBLIC_EXPERIMENTAL_ITINERARIES_ENABLED = "true";
  process.env.EXPO_PUBLIC_EXPERIMENTAL_IOS_MAPS_API_KEY = "test";
  useJourneyOriginStore.getState().clearOrigin();
  useItinerarySelectionStore.setState({ selected: null });
});
afterEach(() => {
  if (previousFlag === undefined)
    delete process.env.EXPO_PUBLIC_EXPERIMENTAL_ITINERARIES_ENABLED;
  else process.env.EXPO_PUBLIC_EXPERIMENTAL_ITINERARIES_ENABLED = previousFlag;
  jest.resetAllMocks();
});
function renderDetail(map = false) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      {map ? <JourneyRoute /> : <ItineraryJourneyScreen businessId={12} />}
    </QueryClientProvider>,
  );
}

it.each([0, 1, 2] as const)(
  "opens the map directly for %i transfers with a collapsed sheet",
  async (count) => {
    const detail = detailFor(count);
    detail.max_transfers = 2;
    detail.transfers.forEach((t) => {
      t.walk = { ...walk, straight_line_distance_meters: 0 };
    });
    const result = resultsFor(detail);
    result.coverage.incomplete_reason = "candidate_budget";
    result.coverage.variants_outside_graph = [9];
    jest
      .mocked(searchExperimentalItineraries)
      .mockResolvedValue({ success: true, message: "", data: result });
    jest
      .mocked(getExperimentalItinerary)
      .mockResolvedValue({ success: true, message: "", data: detail });
    const options = await renderRoute();
    await fireEvent.press(
      await options.findByRole("button", { name: /Open J1/ }),
    );
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(explorer)/business/[businessId]/journey-map",
      params: { businessId: 12 },
    });
    const screen = await renderDetail(true);
    const map = await screen.findByTestId("experimental-itinerary-map");
    expect(screen.getAllByTestId(/^itinerary-ride-/)).toHaveLength(count + 1);
    expect(screen.getByTestId("itinerary-ride-0").props.strokeColor).toBe(
      "#F27F0D",
    );
    if (count)
      expect(screen.getByTestId("itinerary-ride-1").props.strokeColor).toBe(
        "#2693FF",
      );
    const sheet = screen.getByTestId("persistent-sheet");
    expect(sheet.props.enableDynamicSizing).toBe(false);
    expect(sheet.props.snapPoints).toHaveLength(3);
    expect(screen.queryByTestId("solid-ride-0")).toBeNull();
    expect(screen.getByTestId("itinerary-search-coverage")).toBeTruthy();
    expect(screen.getByText("Going to")).toBeTruthy();
    expect(screen.getByText("Fixture business")).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: "Back to journeys" }),
    ).toHaveLength(1);
    expect(map.props.googleMapId).toBeUndefined();
    expect(map.props.customMapStyle).toBeDefined();
    expect(
      screen.getByTestId("route-screen-options").props.options.headerShown,
    ).toBe(false);
    expect(map.props.mapPadding).toBeUndefined();
    await fireEvent(map, "onLayout", {
      nativeEvent: { layout: { width: 390, height: 844 } },
    });
    expect(
      screen.getByTestId("experimental-itinerary-map").props.mapPadding,
    ).toBeUndefined();
    await fireEvent(map, "onMapReady");
    expect(
      screen.getByTestId("experimental-itinerary-map").props.mapPadding.bottom,
    ).toBeGreaterThan(0);
    await waitFor(() => expect(mockFit).toHaveBeenCalled());
    const fitCount = mockFit.mock.calls.length;
    await fireEvent(map, "onRegionChangeComplete");
    expect(mockFit).toHaveBeenCalledTimes(fitCount);
    await fireEvent.press(
      screen.getByRole("button", { name: "Show journey steps" }),
    );
    expect(screen.getAllByTestId(/^solid-ride-/)).toHaveLength(count + 1);
    expect(screen.queryAllByTestId(/^dotted-transfer-/)).toHaveLength(count);
    await fireEvent.press(
      screen.getByRole("button", { name: "Focus ride J1" }),
    );
    expect(screen.getByTestId("itinerary-ride-0").props.strokeWidth).toBe(10);
    await waitFor(() => expect(mockFit).toHaveBeenCalled());
    await fireEvent.press(
      screen.getByRole("button", { name: "Show full instructions" }),
    );
    expect(screen.getByText(/Actual walking routes may differ/)).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Collapse journey steps" }),
    );
    expect(screen.queryByTestId("solid-ride-0")).toBeNull();
    await fireEvent.press(
      screen.getByRole("button", { name: "Back to journeys" }),
    );
    expect(router.back).toHaveBeenCalled();
    expect(searchExperimentalItineraries).toHaveBeenCalledTimes(1);
    expect(getExperimentalItinerary).toHaveBeenCalledTimes(1);
    expect(options.getByRole("button", { name: /Open J1/ })).toBeTruthy();
  },
);
it("anchors bubble context to access points and supplies missing-landmark fallbacks", () => {
  const detail = detailFor(2);
  expect(accessPoint(journeyLabels(detail)[0].access)).toEqual(origin);
  expect(journeyLabels(detail)[0].access.landmark?.location).toEqual(
    destination,
  );
  detail.ride_legs.forEach((ride) => {
    ride.boarding = { ...ride.boarding, landmark: null };
    ride.alighting = { ...ride.alighting, landmark: null };
  });
  expect(journeyLabels(detail).map((label) => label.text)).toEqual([
    "Suggested boarding area",
    "Suggested transfer area",
    "Suggested transfer area",
    "Suggested alighting area",
  ]);
});
it("handles a stale signed selection without another search", async () => {
  const detail = detailFor(0);
  useItinerarySelectionStore.getState().select({
    businessId: 12,
    search: resultsFor(detail),
    token: "stale",
    destinationName: "Fixture",
  });
  jest.mocked(getExperimentalItinerary).mockResolvedValue({
    success: false,
    code: "EXPIRED_ITINERARY",
    message: "Search again",
  });
  const screen = await renderDetail();
  await screen.findByText("Search again for current journeys");
  expect(searchExperimentalItineraries).not.toHaveBeenCalled();
});
it("retains reviewed labels and renders missing landmarks safely", async () => {
  const detail = detailFor(0);
  detail.ride_legs[0].route_alignment_status = "reviewed";
  detail.ride_legs[0].boarding.landmark = null;
  detail.ride_legs[0].alighting.landmark = null;
  useItinerarySelectionStore.getState().select({
    businessId: 12,
    search: resultsFor(detail),
    token: "reviewed",
    destinationName: "Fixture",
    detail,
  });
  const screen = await renderDetail();
  await screen.findByText("Toward End 1");
  expect(screen.getByText("Head to boarding area")).toBeTruthy();
  expect(getExperimentalItinerary).not.toHaveBeenCalled();
});

it("keeps automatic search failure retryable", async () => {
  jest.mocked(searchExperimentalItineraries).mockResolvedValue({
    success: false,
    code: "NETWORK_ERROR",
    message: "Offline",
  });
  const screen = await renderRoute();
  await screen.findByText("Could not search journeys");
  await fireEvent.press(
    screen.getByRole("button", { name: /Could not search journeys.*retry/i }),
  );
  await waitFor(() =>
    expect(searchExperimentalItineraries).toHaveBeenCalledTimes(2),
  );
  expect(getExperimentalItinerary).not.toHaveBeenCalled();
});

it("consumes Android Back for selection, then sheet expansion, before leaving", async () => {
  let handleBack: () => boolean | null | undefined = () => false;
  const subscription = jest
    .spyOn(BackHandler, "addEventListener")
    .mockImplementation((_, callback) => {
      handleBack = () => callback({} as never);
      return { remove: jest.fn() };
    });
  const detail = detailFor(0);
  useItinerarySelectionStore.getState().select({
    businessId: 12,
    search: resultsFor(detail),
    token: "back",
    destinationName: "Fixture",
    detail,
  });
  const screen = await renderDetail(true);
  await fireEvent.press(
    screen.getByRole("button", { name: "Show journey steps" }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Focus ride J1" }));
  await act(() => {
    expect(handleBack()).toBe(true);
  });
  expect(screen.getByTestId("itinerary-ride-0").props.strokeWidth).toBe(7);
  await act(() => {
    expect(handleBack()).toBe(true);
  });
  expect(screen.queryByTestId("solid-ride-0")).toBeNull();
  expect(handleBack()).toBe(false);
  subscription.mockRestore();
});

it("disables automatic headers only for screens with their own guide navigation", async () => {
  const screen = await render(<BusinessLayout />);
  for (const name of [
    "experimental-itineraries",
    "journey-map",
    "journey-details",
  ])
    expect(screen.getByTestId(name).props.options.headerShown).toBe(false);
  expect(screen.getByTestId("jeepney-guide").props.options.title).toBe(
    "Jeepney Guide",
  );
});
it("keeps access actions contextual and preserves the selected request coordinates", async () => {
  const detail = detailFor(1);
  jest.mocked(openGoogleMapsWalkingDirections).mockResolvedValue("opened");
  useItinerarySelectionStore.getState().select({
    businessId: 12,
    search: resultsFor(detail),
    token: "access",
    destinationName: "Fixture",
    detail,
  });
  const screen = await renderDetail(true);
  expect(screen.queryByText("Walking directions in Google Maps")).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Show journey steps" }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Focus ride J1" }));
  await fireEvent.press(
    screen.getByRole("button", { name: "Show full instructions" }),
  );
  expect(screen.queryByText("Walking directions in Google Maps")).toBeNull();
  await fireEvent.press(screen.getByText("Head to boarding area"));
  await fireEvent.press(screen.getByText("Walking directions in Google Maps"));
  expect(openGoogleMapsWalkingDirections).toHaveBeenCalledWith(
    walk.from,
    walk.to,
  );
  expect(screen.queryByText(/Nearby landmark.*Sample hall/)).toBeNull();
  expect(screen.getAllByText("Local source")).toHaveLength(1);
});
it("shows uncovered routes even when no work-limit flag was set", async () => {
  const detail = detailFor(0);
  const result = resultsFor(detail);
  result.max_transfers = 2;
  result.coverage.alternatives_unchecked = false;
  result.coverage.incomplete_reason = null;
  result.coverage.variants_outside_graph = [9];
  useItinerarySelectionStore.getState().select({
    businessId: 12,
    search: result,
    token: "coverage",
    destinationName: "Fixture",
    detail,
  });
  const screen = await renderDetail(true);
  expect(screen.getByText(/Some routes excluded./)).toBeTruthy();
  expect(screen.queryByText("Search ended early.")).toBeNull();
});

it("shows one guide header and binds each card to its own distance in backend order", async () => {
  const result = resultsFor(detailFor(0));
  result.options[0] = {
    ...result.options[0],
    straight_line_walking_distance_meters: 90,
  };
  result.options.push({
    ...result.options[0],
    selection: "second",
    rank: 2,
    route_sequence: ["OTHER"],
    straight_line_walking_distance_meters: 240,
  });
  jest
    .mocked(searchExperimentalItineraries)
    .mockResolvedValue({ success: true, message: "", data: result });
  const screen = await renderRoute();
  await screen.findByText("2 found");
  expect(screen.getAllByText("Jeepney Guide")).toHaveLength(1);
  expect(screen.getAllByRole("button", { name: "Go back" })).toHaveLength(1);
  expect(screen.queryByText("Jeepney itinerary preview")).toBeNull();
  expect(screen.getByText(/~90 m walking estimate/)).toBeTruthy();
  expect(screen.getByText(/~240 m walking estimate/)).toBeTruthy();
  expect(
    screen
      .getAllByRole("button", { name: /Open .* itinerary/ })
      .map((node) => node.props.accessibilityLabel),
  ).toEqual(["Open J1 itinerary", "Open OTHER itinerary"]);
});

it.each(["shared", "distinct", "conflicting landmark", "reported gap"])(
  "groups transfer presentation conservatively: %s",
  (kind) => {
    const detail = detailFor(1);
    const from = detail.ride_legs[0].alighting;
    const to = { ...detail.ride_legs[1].boarding };
    if (kind === "distinct")
      to.access_coordinate = {
        latitude: origin.latitude + 0.00001,
        longitude: origin.longitude,
      };
    if (kind === "conflicting landmark")
      to.landmark = { ...access.landmark!, place_id: "different" };
    expect(sharesTransferArea(from, to, kind === "reported gap" ? 10 : 0)).toBe(
      kind === "shared",
    );
  },
);

it("shows journey skeletons while search and signed map details are pending", async () => {
  jest
    .mocked(searchExperimentalItineraries)
    .mockReturnValue(new Promise(() => {}));
  const options = await renderRoute();
  expect(await options.findByTestId("journey-cards-loading")).toBeTruthy();
  expect(options.queryByText("Finding journeys…")).toBeNull();
  options.unmount();
  const detail = detailFor(1);
  useItinerarySelectionStore.getState().select({
    businessId: 12,
    search: resultsFor(detail),
    token: "pending-details",
    destinationName: "Fixture",
  });
  jest.mocked(getExperimentalItinerary).mockReturnValue(new Promise(() => {}));
  const map = await renderDetail(true);
  expect(await map.findByTestId("journey-map-loading")).toBeTruthy();
  expect(map.queryByTestId("experimental-itinerary-map")).toBeNull();
  expect(map.queryByText("Loading journey…")).toBeNull();
  map.unmount();
});
it("keeps the new Going To header business-only", async () => {
  const screen = await render(
    <JeepneyRouteContextCard
      businessName="Fixture business"
      businessCoverPhotoUrl="https://example.com/business.jpg"
      onBack={jest.fn()}
    />,
  );
  expect(await screen.findByText("Going to")).toBeTruthy();
  expect(screen.getByText("Fixture business")).toBeTruthy();
  expect(screen.queryByText("Selected journey")).toBeNull();
  expect(screen.queryByText(/ride/)).toBeNull();
  expect(screen.getAllByRole("button", { name: "Go back" })).toHaveLength(1);
});

it.each([false, true])(
  "shows the existing mascot empty state with coverage-aware copy (incomplete: %s)",
  async (incomplete) => {
    const result = resultsFor(detailFor(0));
    result.options = [];
    result.reason = "no_route_near_origin";
    result.coverage.alternatives_unchecked = incomplete;
    result.coverage.incomplete_reason = incomplete ? "candidate_budget" : null;
    jest
      .mocked(searchExperimentalItineraries)
      .mockResolvedValue({ success: true, message: "", data: result });
    const screen = await renderRoute();
    expect(await screen.findByText("No journey suggestion yet")).toBeTruthy();
    expect(
      screen.getByText(/not.*added.*SugboGo|not be added yet/),
    ).toBeTruthy();
    expect(
      screen.queryByText(
        "No jeepney route was found near your starting point.",
      ),
    ).toBeNull();
    if (incomplete)
      expect(screen.getByTestId("itinerary-search-coverage")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Retry route search" }),
    );
    await waitFor(() =>
      expect(searchExperimentalItineraries).toHaveBeenCalledTimes(2),
    );
  },
);
