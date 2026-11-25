import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import ExperimentalItinerariesRoute from "@/app/(explorer)/business/[businessId]/experimental-itineraries";

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
beforeEach(() => {
  mockDeviceLocation = origin;
  process.env.EXPO_PUBLIC_EXPERIMENTAL_IOS_MAPS_API_KEY = "test-map-key";
  process.env.EXPO_PUBLIC_EXPERIMENTAL_ITINERARIES_ENABLED = "true";
});
afterEach(() => {
  if (previousFlag === undefined) delete process.env.EXPO_PUBLIC_EXPERIMENTAL_ITINERARIES_ENABLED;
  else process.env.EXPO_PUBLIC_EXPERIMENTAL_ITINERARIES_ENABLED = previousFlag;
  if (previousIosKey === undefined) delete process.env.EXPO_PUBLIC_EXPERIMENTAL_IOS_MAPS_API_KEY;
  else process.env.EXPO_PUBLIC_EXPERIMENTAL_IOS_MAPS_API_KEY = previousIosKey;
  jest.resetAllMocks();
});

it("keeps direct navigation disabled without the experiment flag", async () => {
  delete process.env.EXPO_PUBLIC_EXPERIMENTAL_ITINERARIES_ENABLED;
  const screen = await renderRoute();
  expect(screen.getByText("Experiment disabled")).toBeTruthy();
  expect(searchExperimentalItineraries).not.toHaveBeenCalled();
});

it.each([0, 1, 2] as const)("opens %i transfers and renders each ride, walk, and candidate", async (count) => {
  const detail = detailFor(count);
  jest.mocked(searchExperimentalItineraries).mockResolvedValue({
    success: true, message: "", data: resultsFor(detail),
  });
  jest.mocked(getExperimentalItinerary).mockResolvedValue({
    success: true, message: "", data: detail,
  });
  const screen = await renderRoute();
  await fireEvent.press(screen.getByLabelText(`${count} maximum transfers`));
  await fireEvent.press(screen.getByRole("button", { name: "Search itineraries" }));
  await screen.findByText(/Some alternatives were outside/);
  await fireEvent.press(screen.getByRole("button", { name: /Open J1/ }));
  await screen.findByTestId("experimental-itinerary-map");

  expect(searchExperimentalItineraries).toHaveBeenCalledWith(12, origin, count);
  expect(getExperimentalItinerary).toHaveBeenCalledWith(12, "signed-selection");
  expect(screen.getAllByTestId(/^itinerary-ride-/)).toHaveLength(count + 1);
  expect(screen.getAllByTestId(/^itinerary-walk-/)).toHaveLength(count + 2);
  expect(screen.getByTestId("itinerary-1-board").props.title).toBe("Boarding candidate");
  expect(screen.getByText("Unreviewed direction label · toward End 1")).toBeTruthy();
  expect(screen.getByText(/Geometry preview only\. Jeepney service/)).toBeTruthy();
  expect(screen.getByText("From your starting point to the first ride")).toBeTruthy();
  expect(screen.getByText("From the last ride to your destination")).toBeTruthy();
  if (count) expect(screen.getByText("Change to J2")).toBeTruthy();
  expect(screen.getByText(/Google walking routes are in beta/)).toBeTruthy();
  expect(screen.getAllByText("Mocked warning")).toHaveLength(count + 2);
  expect(screen.getAllByText("Google Maps").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Local source").length).toBeGreaterThan(0);
});

it("uses verified labels only when the selected itinerary carries passenger access evidence", async () => {
  const verified: ItineraryAccess = {
    ...access,
    coordinate_status: "verified",
    permission: "permitted",
    passenger_location_verified: true,
  };
  const preview = detailFor(1);
  const detail: ItineraryDetail = {
    ...preview,
    route_alignment_status: "reviewed",
    passenger_access_verified: true,
    passenger_ready: true,
    ride_legs: preview.ride_legs.map((ride) => ({
      ...ride,
      route_alignment_status: "reviewed",
      boarding: verified,
      alighting: verified,
    })),
    transfers: preview.transfers.map((transfer) => ({
      ...transfer,
      validation_status: "pedestrian_validated",
      passenger_access_verified: true,
      passenger_ready: true,
    })),
  };
  jest.mocked(searchExperimentalItineraries).mockResolvedValue({
    success: true, message: "", data: resultsFor(detail),
  });
  jest.mocked(getExperimentalItinerary).mockResolvedValue({
    success: true, message: "", data: detail,
  });
  const screen = await renderRoute();
  await fireEvent.press(screen.getByLabelText("1 maximum transfers"));
  await fireEvent.press(screen.getByRole("button", { name: "Search itineraries" }));
  await fireEvent.press(await screen.findByRole("button", { name: /Open J1/ }));
  await screen.findByTestId("experimental-itinerary-map");

  expect(screen.getByTestId("itinerary-1-board").props.title).toBe("Verified boarding location");
  expect(screen.getAllByText("Passenger access verified")).toHaveLength(2);
  expect(screen.queryByText("Transfer locations unconfirmed")).toBeNull();
});

it("labels a disputed route as geometry even when access has been checked", async () => {
  const preview = detailFor(0);
  const verified: ItineraryAccess = {
    ...access,
    coordinate_status: "verified",
    permission: "permitted",
    passenger_location_verified: true,
  };
  const detail: ItineraryDetail = {
    ...preview,
    route_alignment_status: "disputed",
    passenger_access_verified: true,
    ride_legs: [{
      ...preview.ride_legs[0],
      route_alignment_status: "disputed",
      route_provenance: "Example route review",
      boarding: verified,
      alighting: verified,
    }],
  };
  jest.mocked(searchExperimentalItineraries).mockResolvedValue({
    success: true, message: "", data: resultsFor(detail),
  });
  jest.mocked(getExperimentalItinerary).mockResolvedValue({ success: true, message: "", data: detail });
  const screen = await renderRoute();
  await fireEvent.press(screen.getByLabelText("0 maximum transfers"));
  await fireEvent.press(screen.getByRole("button", { name: "Search itineraries" }));
  await screen.findByText(/recorded route is disputed/);
  await fireEvent.press(await screen.findByRole("button", { name: /Open J1/ }));
  await screen.findByText(/Disputed direction label/);

  expect(screen.getByText(/Do not use it for boarding/)).toBeTruthy();
  expect(screen.getByText("Route source · Example route review")).toBeTruthy();
  expect(screen.getByTestId("itinerary-1-board").props.title).toBe("Boarding candidate");
  expect(screen.queryByText("Passenger access verified")).toBeNull();
});

it("distinguishes an empty search from a provider failure and stale selection", async () => {
  const result = resultsFor(detailFor(2));
  jest.mocked(searchExperimentalItineraries)
    .mockResolvedValueOnce({
      success: true, message: "", data: { ...result, options: [], reason: "no_geometric_journey" },
    })
    .mockResolvedValueOnce({
      success: true,
      message: "",
      data: { ...result, options: [{ ...result.options[0], walking_statuses: ["timeout"] }] },
    });
  jest.mocked(getExperimentalItinerary).mockResolvedValue({
    success: false, code: "STALE_ITINERARY", message: "Search again.",
  });
  const screen = await renderRoute();
  await fireEvent.press(screen.getByRole("button", { name: "Search itineraries" }));
  await screen.findByText(/No route candidate found/);
  await fireEvent.press(screen.getByRole("button", { name: "Search itineraries" }));
  await screen.findByText("Walking check unavailable");
  await fireEvent.press(screen.getByRole("button", { name: /Open J1/ }));
  await waitFor(() => expect(screen.getByText("This preview needs a new search")).toBeTruthy());
  expect(screen.queryByTestId("experimental-itinerary-map")).toBeNull();
});

it.each([true, false])("shows incomplete search coverage with or without a result (%s)", async (hasResult) => {
  const result = resultsFor(detailFor(2));
  jest.mocked(searchExperimentalItineraries).mockResolvedValue({
    success: true,
    message: "",
    data: {
      ...result,
      reason: hasResult ? null : "search_incomplete",
      options: hasResult ? result.options : [],
      coverage: { ...result.coverage, incomplete_reason: "candidate_budget" },
    },
  });
  const screen = await renderRoute();
  await fireEvent.press(screen.getByRole("button", { name: "Search itineraries" }));
  await screen.findByText(hasResult ? /from an incomplete search/ : /search ended before/);
  expect(screen.queryByText(/No route candidate found/)).toBeNull();
  expect(Boolean(screen.queryByRole("button", { name: /Open J1/ }))).toBe(hasResult);
});

it.each([
  ["no_route_near_origin", null, /no jeepney route was found near your starting point/i],
  ["no_route_near_destination", null, /no jeepney route was found near this destination/i],
  ["no_forward_journey", null, /direction of travel/i],
  ["candidate_excluded_by_validation", "spatial", /did not pass the preview/i],
  ["candidate_excluded_by_validation", "minimum_ride_distance", /rides found were too short/i],
] as const)("explains an empty response with reason %s", async (reason, validationStage, message) => {
  const result = resultsFor(detailFor(2));
  jest.mocked(searchExperimentalItineraries).mockResolvedValue({
    success: true,
    message: "",
    data: {
      ...result,
      options: [],
      reason,
      validation_stage: validationStage,
      coverage: { ...result.coverage, alternatives_unchecked: false },
    },
  });
  const screen = await renderRoute();
  await fireEvent.press(screen.getByRole("button", { name: "Search itineraries" }));
  await screen.findByText(message);
});

it("keeps the submitted search visible after a device location update", async () => {
  const result = resultsFor(detailFor(2));
  jest.mocked(searchExperimentalItineraries).mockImplementation(async () => {
    mockDeviceLocation = { ...origin, latitude: origin.latitude + 0.00001 };
    return {
      success: true,
      message: "",
      data: {
        ...result,
        coverage: { ...result.coverage, walking_provider_unavailable: true },
      },
    };
  });
  const screen = await renderRoute();
  await fireEvent.press(screen.getByRole("button", { name: "Search itineraries" }));
  await screen.findByRole("button", { name: /Open J1/ });
  expect(screen.getByText(/Some walking checks are temporarily unavailable/)).toBeTruthy();
  expect(searchExperimentalItineraries).toHaveBeenCalledWith(12, origin, 2);
});

it("keeps malformed and unconfirmed paths off the map while preserving walking warnings", async () => {
  const preview = detailFor(1);
  const detail: ItineraryDetail = {
    ...preview,
    access_walk: {
      ...walk,
      status: "unsuitable_endpoints",
      mapped_distance_meters: null,
      diagnostic_code: "displaced_provider_endpoint",
    },
    egress_walk: { ...walk, status: "provider_error", mapped_distance_meters: null },
    ride_legs: [
      { ...preview.ride_legs[0], geometry: [origin, origin] },
      preview.ride_legs[1],
    ],
    transfers: [{ ...preview.transfers[0], walk: { ...walk, encoded_polyline: "????" } }],
  };
  jest.mocked(searchExperimentalItineraries).mockResolvedValue({
    success: true, message: "", data: resultsFor(detail),
  });
  jest.mocked(getExperimentalItinerary).mockResolvedValue({ success: true, message: "", data: detail });
  const screen = await renderRoute();
  await fireEvent.press(screen.getByLabelText("1 maximum transfers"));
  await fireEvent.press(screen.getByRole("button", { name: "Search itineraries" }));
  await fireEvent.press(await screen.findByRole("button", { name: /Open J1/ }));
  await screen.findByTestId("experimental-itinerary-map");

  expect(screen.queryByTestId("itinerary-ride-0")).toBeNull();
  expect(screen.getByTestId("itinerary-ride-1")).toBeTruthy();
  expect(screen.queryAllByTestId(/^itinerary-walk-/)).toHaveLength(0);
  expect(screen.getByText("Jeepney path unavailable on the map")).toBeTruthy();
  expect(screen.getByText("A walking path to this location could not be confirmed")).toBeTruthy();
  expect(screen.getByText("Walking check unavailable")).toBeTruthy();
  expect(screen.queryByText(/displaced_provider_endpoint/)).toBeNull();
  expect(screen.getAllByText("Mocked warning")).toHaveLength(3);
});

it("presents blocked walks as a diagnostic preview with the specific failure", async () => {
  const detail: ItineraryDetail = {
    ...detailFor(0),
    has_blocking_evidence: true,
    access_walk: {
      ...walk,
      status: "distance_limit",
      mapped_distance_meters: null,
      provider_distance_meters: 1379,
      distance_limit_meters: 800,
    },
    egress_walk: {
      ...walk,
      status: "unsuitable_endpoints",
      mapped_distance_meters: null,
      diagnostic_code: "collapsed_provider_path",
    },
  };
  const search = resultsFor(detail);
  search.options[0].has_blocking_evidence = true;
  jest.mocked(searchExperimentalItineraries).mockResolvedValue({ success: true, message: "", data: search });
  jest.mocked(getExperimentalItinerary).mockResolvedValue({ success: true, message: "", data: detail });
  const screen = await renderRoute();
  await fireEvent.press(screen.getByLabelText("0 maximum transfers"));
  await fireEvent.press(screen.getByRole("button", { name: "Search itineraries" }));
  await screen.findByText(/Diagnostic preview · walking connection/);
  await fireEvent.press(await screen.findByRole("button", { name: /Open J1/ }));
  await screen.findByText(/Diagnostic preview only/);
  expect(screen.getByText(/Mapped walk .*preview limit/)).toBeTruthy();
  expect(screen.getByText(/could not connect these two locations reliably/)).toBeTruthy();
  expect(screen.queryAllByTestId(/^itinerary-walk-/)).toHaveLength(0);
});
