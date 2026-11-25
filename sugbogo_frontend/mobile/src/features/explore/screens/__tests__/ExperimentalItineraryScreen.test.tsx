import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { openGoogleMapsWalkingDirections } from "../../services/googleMapsHandoff.service";

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
    Stack: { Screen: () => null },
    router: { push: jest.fn() },
    useLocalSearchParams: () => ({ businessId: "12" }),
  };
});
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: require("react-native").View }));
jest.mock("react-native-maps", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: View, Marker: View, Polyline: View, PROVIDER_GOOGLE: "google" };
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
jest.mock("../../services/googleMapsHandoff.service", () => ({ openGoogleMapsWalkingDirections: jest.fn() }));

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
      boarding: access,
      alighting: access,
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
    options: [{
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
    }],
  };
}

function renderRoute() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ExperimentalItinerariesRoute />
    </QueryClientProvider>,
  );
}

const previousFlag = process.env.EXPO_PUBLIC_EXPERIMENTAL_ITINERARIES_ENABLED;
const previousIosKey = process.env.EXPO_PUBLIC_EXPERIMENTAL_IOS_MAPS_API_KEY;
const previousDevelopmentMode = __DEV__;
beforeEach(() => {
  useJourneyOriginStore.getState().clearOrigin();
  Object.defineProperty(globalThis, "__DEV__", { value: true });
  mockDeviceLocation = origin;
  process.env.EXPO_PUBLIC_EXPERIMENTAL_IOS_MAPS_API_KEY = "test-map-key";
  delete process.env.EXPO_PUBLIC_EXPERIMENTAL_ITINERARIES_ENABLED;
});
afterEach(() => {
  useJourneyOriginStore.getState().clearOrigin();
  Object.defineProperty(globalThis, "__DEV__", { value: previousDevelopmentMode });
  if (previousFlag === undefined) delete process.env.EXPO_PUBLIC_EXPERIMENTAL_ITINERARIES_ENABLED;
  else process.env.EXPO_PUBLIC_EXPERIMENTAL_ITINERARIES_ENABLED = previousFlag;
  if (previousIosKey === undefined) delete process.env.EXPO_PUBLIC_EXPERIMENTAL_IOS_MAPS_API_KEY;
  else process.env.EXPO_PUBLIC_EXPERIMENTAL_IOS_MAPS_API_KEY = previousIosKey;
  jest.resetAllMocks();
});

it("keeps release access disabled without explicit opt-in", async () => {
  Object.defineProperty(globalThis, "__DEV__", { value: false });
  delete process.env.EXPO_PUBLIC_EXPERIMENTAL_ITINERARIES_ENABLED;
  const screen = await renderRoute();
  expect(screen.getByText("Experiment disabled")).toBeTruthy();
  expect(searchExperimentalItineraries).not.toHaveBeenCalled();
});

it.each([0, 1, 2] as const)("shows %i transfers as geometric guidance with optional walking", async (count) => {
  const detail = detailFor(count);
  detail.access_walk = { ...walk, status: "not_evaluated", mapped_distance_meters: null };
  detail.egress_walk = { ...walk, status: "not_evaluated", mapped_distance_meters: null };
  jest.mocked(searchExperimentalItineraries).mockResolvedValue({ success: true, message: "", data: resultsFor(detail) });
  jest.mocked(getExperimentalItinerary).mockResolvedValue({ success: true, message: "", data: detail });
  jest.mocked(openGoogleMapsWalkingDirections).mockResolvedValue("opened");
  const screen = await renderRoute();
  await fireEvent.press(screen.getByLabelText(`${count} maximum transfers`));
  await fireEvent.press(screen.getByRole("button", { name: "Search itineraries" }));
  await fireEvent.press(await screen.findByRole("button", { name: /Open J1/ }));
  await screen.findByTestId("experimental-itinerary-map");

  expect(screen.getAllByTestId(/^itinerary-ride-/)).toHaveLength(count + 1);
  expect(screen.queryAllByTestId(/^itinerary-walk-/)).toHaveLength(0);
  expect(screen.getByText("Ride J1")).toBeTruthy();
  expect(screen.queryByText(/toward End 1/)).toBeNull();
  expect(screen.getByText(/Route alignment and recorded direction are unreviewed/)).toBeTruthy();
  expect(screen.getAllByText(/estimated straight-line distance/)).toHaveLength(count + 2);
  expect(screen.getAllByText("Google Maps").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Local source").length).toBeGreaterThan(0);
  expect(openGoogleMapsWalkingDirections).not.toHaveBeenCalled();
  await fireEvent.press(screen.getAllByRole("button", { name: "Walking directions" })[0]);
  await waitFor(() => expect(openGoogleMapsWalkingDirections).toHaveBeenCalledWith(origin, destination));
});

it("preserves approximate guidance when old walking diagnostics are present", async () => {
  const detail = detailFor(0);
  detail.has_blocking_evidence = true;
  detail.access_walk = { ...walk, status: "distance_limit", mapped_distance_meters: null };
  detail.egress_walk = { ...walk, status: "unsuitable_endpoints", mapped_distance_meters: null };
  jest.mocked(searchExperimentalItineraries).mockResolvedValue({ success: true, message: "", data: resultsFor(detail) });
  jest.mocked(getExperimentalItinerary).mockResolvedValue({ success: true, message: "", data: detail });
  const screen = await renderRoute();
  await fireEvent.press(screen.getByLabelText("0 maximum transfers"));
  await fireEvent.press(screen.getByRole("button", { name: "Search itineraries" }));
  await fireEvent.press(await screen.findByRole("button", { name: /Open J1/ }));
  await screen.findByTestId("experimental-itinerary-map");
  expect(screen.queryByText(/mapped walk is too far/i)).toBeNull();
  expect(screen.queryByText(/walking connection failed/i)).toBeNull();
  expect(screen.queryByText("Mocked warning")).toBeNull();
  expect(screen.queryAllByTestId(/^itinerary-walk-/)).toHaveLength(0);
});

it("reports a failed optional Google Maps handoff", async () => {
  const detail = detailFor(0);
  jest.mocked(searchExperimentalItineraries).mockResolvedValue({ success: true, message: "", data: resultsFor(detail) });
  jest.mocked(getExperimentalItinerary).mockResolvedValue({ success: true, message: "", data: detail });
  jest.mocked(openGoogleMapsWalkingDirections).mockResolvedValue("failed");
  const screen = await renderRoute();
  await fireEvent.press(screen.getByLabelText("0 maximum transfers"));
  await fireEvent.press(screen.getByRole("button", { name: "Search itineraries" }));
  await fireEvent.press(await screen.findByRole("button", { name: /Open J1/ }));
  await screen.findByTestId("experimental-itinerary-map");
  await fireEvent.press(screen.getAllByRole("button", { name: "Walking directions" })[0]);
  await screen.findByText(/Could not open Google Maps/);
});

it("shows no landmarks without losing geometry or optional directions", async () => {
  const detail = detailFor(0);
  detail.ride_legs = detail.ride_legs.map((ride) => ({
    ...ride, boarding: { ...access, landmark: null }, alighting: { ...access, landmark: null },
  }));
  jest.mocked(searchExperimentalItineraries).mockResolvedValue({ success: true, message: "", data: resultsFor(detail) });
  jest.mocked(getExperimentalItinerary).mockResolvedValue({ success: true, message: "", data: detail });
  const screen = await renderRoute();
  await fireEvent.press(screen.getByLabelText("0 maximum transfers"));
  await fireEvent.press(screen.getByRole("button", { name: "Search itineraries" }));
  await fireEvent.press(await screen.findByRole("button", { name: /Open J1/ }));
  await screen.findByTestId("itinerary-ride-0");
  expect(screen.queryByText(/Nearby landmark/)).toBeNull();
  expect(screen.getAllByRole("button", { name: "Walking directions" })).toHaveLength(2);
});

it("keeps stale selection and incomplete search states distinct", async () => {
  const result = resultsFor(detailFor(2));
  result.coverage.incomplete_reason = "candidate_budget";
  jest.mocked(searchExperimentalItineraries).mockResolvedValue({ success: true, message: "", data: result });
  jest.mocked(getExperimentalItinerary).mockResolvedValue({ success: false, code: "STALE_ITINERARY", message: "Search again." });
  const screen = await renderRoute();
  await fireEvent.press(screen.getByRole("button", { name: "Search itineraries" }));
  await screen.findByText(/search ended early/i);
  await fireEvent.press(await screen.findByRole("button", { name: /Open J1/ }));
  await screen.findByText("This preview needs a new search");
  expect(screen.queryByTestId("experimental-itinerary-map")).toBeNull();
});

it("keeps results visible after a device GPS update", async () => {
  const result = resultsFor(detailFor(2));
  jest.mocked(searchExperimentalItineraries).mockImplementation(async () => {
    mockDeviceLocation = { ...origin, latitude: origin.latitude + 0.00001 };
    return { success: true, message: "", data: result };
  });
  const screen = await renderRoute();
  await fireEvent.press(screen.getByRole("button", { name: "Search itineraries" }));
  await screen.findByRole("button", { name: /Open J1/ });
});

it("retains network and work coverage after opening the signed detail without searching again", async () => {
  const detail = detailFor(2);
  const result = resultsFor(detail);
  result.coverage = {
    ...result.coverage,
    graph_revision: "internal-fixture-revision",
    graph_variant_count: 3,
    variants_outside_graph: [9],
    incomplete_reason: "candidate_budget",
  };
  jest.mocked(searchExperimentalItineraries).mockResolvedValue({ success: true, message: "", data: result });
  jest.mocked(getExperimentalItinerary).mockResolvedValue({ success: true, message: "", data: detail });
  const screen = await renderRoute();
  await fireEvent.press(screen.getByRole("button", { name: "Search itineraries" }));
  await screen.findByText(/Some routes are not included/);
  await fireEvent.press(await screen.findByRole("button", { name: /Open J1/ }));
  await screen.findByTestId("experimental-itinerary-map");
  expect(screen.getByText(/Some routes are not included.*search ended early/i)).toBeTruthy();
  expect(screen.queryByText(/internal-fixture-revision/)).toBeNull();
  expect(searchExperimentalItineraries).toHaveBeenCalledTimes(1);
  expect(getExperimentalItinerary).toHaveBeenCalledWith(12, "signed-selection");
});

it("describes uncovered routes without claiming that candidate work was exhausted", async () => {
  const detail = detailFor(1);
  const result = resultsFor(detail);
  result.coverage = {
    ...result.coverage,
    graph_variant_count: 3,
    variants_outside_graph: [9],
    incomplete_reason: "connection_budget",
  };
  jest.mocked(searchExperimentalItineraries).mockResolvedValue({ success: true, message: "", data: result });
  jest.mocked(getExperimentalItinerary).mockResolvedValue({ success: true, message: "", data: detail });
  const screen = await renderRoute();
  await fireEvent.press(screen.getByLabelText("1 maximum transfers"));
  await fireEvent.press(screen.getByRole("button", { name: "Search itineraries" }));
  await fireEvent.press(await screen.findByRole("button", { name: /Open J1/ }));
  await screen.findByTestId("experimental-itinerary-map");
  expect(screen.getByText(/Some routes are not included/)).toBeTruthy();
  expect(screen.queryByText(/search ended early/i)).toBeNull();
});

it("keeps complete direct coverage complete despite unused transfer coverage exclusions", async () => {
  const detail = detailFor(0);
  const result = resultsFor(detail);
  result.coverage = {
    ...result.coverage,
    graph_variant_count: 3,
    variants_outside_graph: [9],
    alternatives_unchecked: false,
  };
  jest.mocked(searchExperimentalItineraries).mockResolvedValue({ success: true, message: "", data: result });
  jest.mocked(getExperimentalItinerary).mockResolvedValue({ success: true, message: "", data: detail });
  const screen = await renderRoute();
  await fireEvent.press(screen.getByLabelText("0 maximum transfers"));
  await fireEvent.press(screen.getByRole("button", { name: "Search itineraries" }));
  await fireEvent.press(await screen.findByRole("button", { name: /Open J1/ }));
  await screen.findByTestId("experimental-itinerary-map");
  expect(screen.queryByTestId("itinerary-search-coverage")).toBeNull();
});

it("hides source-endpoint direction identifiers while retaining provisional guidance", async () => {
  const detail = detailFor(0);
  detail.ride_legs[0].direction.toward = "Source path endpoint [endpoint-fixture]";
  jest.mocked(searchExperimentalItineraries).mockResolvedValue({ success: true, message: "", data: resultsFor(detail) });
  jest.mocked(getExperimentalItinerary).mockResolvedValue({ success: true, message: "", data: detail });
  const screen = await renderRoute();
  await fireEvent.press(screen.getByLabelText("0 maximum transfers"));
  await fireEvent.press(screen.getByRole("button", { name: "Search itineraries" }));
  await fireEvent.press(await screen.findByRole("button", { name: /Open J1/ }));
  await screen.findByText("Ride J1");
  expect(screen.queryByText(/endpoint-fixture/)).toBeNull();
  expect(screen.getByText(/Suggested areas are approximate/)).toBeTruthy();
  expect(detail.ride_legs[0].direction.toward).toBe("Source path endpoint [endpoint-fixture]");
});

it("retains a reviewed readable direction label", async () => {
  const detail = detailFor(0);
  detail.ride_legs[0].route_alignment_status = "reviewed";
  detail.ride_legs[0].direction.toward = "Reviewed destination";
  jest.mocked(searchExperimentalItineraries).mockResolvedValue({ success: true, message: "", data: resultsFor(detail) });
  jest.mocked(getExperimentalItinerary).mockResolvedValue({ success: true, message: "", data: detail });
  const screen = await renderRoute();
  await fireEvent.press(screen.getByLabelText("0 maximum transfers"));
  await fireEvent.press(screen.getByRole("button", { name: "Search itineraries" }));
  await fireEvent.press(await screen.findByRole("button", { name: /Open J1/ }));
  await screen.findByText("Ride J1 toward Reviewed destination");
});

it("does not show an old selection when the confirmed origin changes", async () => {
  const detail = detailFor(0);
  jest.mocked(searchExperimentalItineraries).mockResolvedValue({ success: true, message: "", data: resultsFor(detail) });
  jest.mocked(getExperimentalItinerary).mockResolvedValue({ success: true, message: "", data: detail });
  const screen = await renderRoute();
  await fireEvent.press(screen.getByLabelText("0 maximum transfers"));
  await fireEvent.press(screen.getByRole("button", { name: "Search itineraries" }));
  await fireEvent.press(await screen.findByRole("button", { name: /Open J1/ }));
  await screen.findByTestId("experimental-itinerary-map");
  await act(() => useJourneyOriginStore.getState().confirmOrigin(12, {
    type: "selected",
    latitude: origin.latitude + 0.01,
    longitude: origin.longitude,
    label: "New starting point",
  }));
  expect(screen.queryByTestId("experimental-itinerary-map")).toBeNull();
  expect(searchExperimentalItineraries).toHaveBeenCalledTimes(1);
});
