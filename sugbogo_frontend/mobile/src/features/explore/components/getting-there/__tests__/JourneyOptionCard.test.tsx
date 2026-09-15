import { fireEvent, render } from "@testing-library/react-native";

import type { DirectJourney } from "../../../types/directJourney.types";
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

describe("JourneyOptionCard", () => {
  it("shows a recommended direct journey with optional landmark context", async () => {
    const screen = await render(
      <JourneyOptionCard
        journey={journey}
        businessName="Sugbo Cafe"
        recommended
      />,
    );

    expect(screen.getByText("Recommended")).toBeTruthy();
    expect(screen.getByText("Kamputhaw → Colon")).toBeTruthy();
    expect(screen.getByText("Head to Capitol")).toBeTruthy();
    expect(screen.getByText("Get off at Colon")).toBeTruthy();
    expect(
      screen.getByText("Near Gaisano Capital South · approx. 85 m from the stop"),
    ).toBeTruthy();
    expect(screen.getByText("Approx. 3.4 km ride")).toBeTruthy();
  });

  it("keeps an alternative compact until the Explorer expands it", async () => {
    const screen = await render(
      <JourneyOptionCard journey={journey} businessName="Sugbo Cafe" />,
    );

    expect(screen.queryByText("Head to Capitol")).toBeNull();

    await fireEvent.press(
      screen.getByRole("button", { name: "14D, Kamputhaw → Colon" }),
    );

    expect(screen.getByText("Head to Capitol")).toBeTruthy();
  });

  it("omits landmark guidance when the backend returns no context", async () => {
    const screen = await render(
      <JourneyOptionCard
        journey={{
          ...journey,
          landmark_context: null,
        }}
        businessName="Sugbo Cafe"
        recommended
      />,
    );

    expect(screen.queryByText(/Near Gaisano/)).toBeNull();
    expect(screen.getByText("Get off at Colon")).toBeTruthy();
  });
});
