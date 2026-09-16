import { fireEvent, render, userEvent } from "@testing-library/react-native";

import type {
  DirectJourney,
  DirectJourneyRouteOption,
} from "../../../types/directJourney.types";
import JourneyOptionCard from "../JourneyOptionCard";

const journey: DirectJourney = {
  journey_type: "direct",
  jeepney_route_code: "14D",
  route_variant_id: 8,
  route_variant_origin: {
    id: 1,
    name: "Kamputhaw",
  },
  route_variant_destination: {
    id: 4,
    name: "Colon",
  },
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

const alternativeJourney: DirectJourney = {
  ...journey,
  boarding_transit_point: {
    ...journey.boarding_transit_point,
    id: 3,
    name: "Fuente",
  },
  boarding_sequence: 3,
  explorer_to_boarding_distance_meters: 240,
};

const routeOption: DirectJourneyRouteOption = {
  jeepney_route_code: "14D",
  recommended_journey: journey,
  alternative_journeys: [alternativeJourney],
};

describe("JourneyOptionCard", () => {
  it("shows one recommended route code with optional landmark context", async () => {
    const onViewMap = jest.fn();
    const screen = await render(
      <JourneyOptionCard
        routeOption={routeOption}
        recommended
        onViewMap={onViewMap}
      />,
    );

    expect(screen.getByText("Recommended")).toBeTruthy();
    expect(screen.getByText("Kamputhaw → Colon")).toBeTruthy();
    expect(screen.getByText("Board at Capitol")).toBeTruthy();
    expect(screen.getByText("Get off at Colon")).toBeTruthy();
    expect(
      screen.getByText("Near Gaisano Capital South · approx. 85 m from the stop"),
    ).toBeTruthy();
    expect(screen.getByText("Approx. 3.4 km ride")).toBeTruthy();
    fireEvent.press(screen.getByText("View on map"));
    expect(onViewMap).toHaveBeenCalledWith(journey);
  });

  it("keeps another route code compact until the Explorer expands it", async () => {
    const user = userEvent.setup();
    const screen = await render(
      <JourneyOptionCard
        routeOption={{
          ...routeOption,
          alternative_journeys: [],
        }}
        onViewMap={jest.fn()}
      />,
    );

    expect(screen.queryByText("Board at Capitol")).toBeNull();

    await user.press(
      screen.getByRole("button", { name: "14D, Kamputhaw → Colon" }),
    );

    expect(screen.getByText("Board at Capitol")).toBeTruthy();
  });

  it("keeps same-code alternatives hidden until explicitly expanded", async () => {
    const user = userEvent.setup();
    const onViewMap = jest.fn();
    const screen = await render(
      <JourneyOptionCard
        routeOption={routeOption}
        recommended
        onViewMap={onViewMap}
      />,
    );

    expect(screen.queryByText("Option 1")).toBeNull();
    const alternativesToggle = screen.getByLabelText("Other ways to ride 14D");
    await user.press(alternativesToggle);
    expect(screen.getByText("Option 1")).toBeTruthy();
    expect(screen.getByText("Fuente")).toBeTruthy();

    const mapActions = screen.getAllByText("View on map");
    fireEvent.press(mapActions[1]);
    expect(onViewMap).toHaveBeenLastCalledWith(alternativeJourney);

    await user.press(alternativesToggle);
    expect(screen.queryByText("Option 1")).toBeNull();
  });

  it("omits the alternatives control when no other ways exist", async () => {
    const screen = await render(
      <JourneyOptionCard
        routeOption={{
          jeepney_route_code: "14D",
          recommended_journey: {
            ...journey,
            landmark_context: null,
          },
          alternative_journeys: [],
        }}
        recommended
        onViewMap={jest.fn()}
      />,
    );

    expect(screen.queryByText(/Other ways to ride/)).toBeNull();
    expect(screen.queryByText(/Near Gaisano/)).toBeNull();
  });
});
