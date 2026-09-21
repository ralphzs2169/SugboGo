import { render, waitFor } from "@testing-library/react-native";

import { theme } from "@/constants/theme";

import type { DirectJourneyMapGuidance } from "../../../types/directJourney.types";
import JeepneyRouteMap from "../JeepneyRouteMap";

const mockFitToCoordinates = jest.fn();

jest.mock("react-native-maps", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");

  const MockMapView = React.forwardRef(
    (
      {
        children,
        onMapReady,
        onMapLoaded,
        ...props
      }: {
        children: React.ReactNode;
        onMapReady?: () => void;
        onMapLoaded?: () => void;
        testID?: string;
      },
      ref: React.Ref<unknown>,
    ) => {
      React.useImperativeHandle(ref, () => ({
        fitToCoordinates: mockFitToCoordinates,
      }));
      React.useEffect(() => {
        onMapReady?.();
        onMapLoaded?.();
      }, [onMapLoaded, onMapReady]);

      return <View {...props}>{children}</View>;
    },
  );
  MockMapView.displayName = "MockMapView";

  return {
    __esModule: true,
    default: MockMapView,
    Marker: ({ children, ...props }: { children?: React.ReactNode }) => (
      <View {...props}>{children}</View>
    ),
    Callout: ({ children }: { children?: React.ReactNode }) => (
      <View>{children}</View>
    ),
    Polyline: (props: object) => <View {...props} />,
    PROVIDER_GOOGLE: "google",
  };
});

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
      { latitude: 10.3173, longitude: 123.8908 },
      { latitude: 10.294, longitude: 123.9003 },
      { latitude: 10.29, longitude: 123.91 },
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
  landmark_context: null,
};

describe("JeepneyRouteMap", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders only the full variant and selected backend segment", async () => {
    const screen = await render(
      <JeepneyRouteMap
        journey={journey}
        originLocation={{ latitude: 10.3, longitude: 123.88 }}
        originMarkerLabel="Current location"
        originMarkerTitle="Current location"
        businessName="Sugbo Cafe"
      />,
    );

    expect(screen.getByTestId("full-route-variant").props.coordinates).toEqual(
      journey.ride.full_variant_geometry,
    );
    expect(
      screen.getByTestId("selected-ride-segment").props.coordinates,
    ).toEqual(journey.ride.selected_segment_geometry);
    expect(
      screen.getByTestId("selected-ride-segment").props.strokeColor,
    ).toBe(theme.extends.colors.brand);
    expect(screen.getAllByTestId(/route|segment/)).toHaveLength(2);
  });

  it("renders four markers and fits the relevant journey once", async () => {
    const explorerLocation = { latitude: 10.3, longitude: 123.88 };
    const screen = await render(
      <JeepneyRouteMap
        journey={journey}
        originLocation={explorerLocation}
        originMarkerLabel="Current location"
        originMarkerTitle="Current location"
        businessName="Sugbo Cafe"
      />,
    );

    expect(screen.getByTestId("explorer-location-marker")).toBeTruthy();
    expect(screen.getByTestId("boarding-transit-point-marker")).toBeTruthy();
    expect(screen.getByTestId("alighting-transit-point-marker")).toBeTruthy();
    expect(screen.getByTestId("business-destination-marker")).toBeTruthy();

    await waitFor(() => {
      expect(mockFitToCoordinates).toHaveBeenCalledWith(
        [
          explorerLocation,
          journey.boarding_transit_point,
          ...journey.ride.selected_segment_geometry,
          journey.alighting_transit_point,
          journey.business_location,
        ],
        expect.objectContaining({
          animated: false,
        }),
      );
    });
    expect(mockFitToCoordinates).toHaveBeenCalledTimes(1);
  });
});
