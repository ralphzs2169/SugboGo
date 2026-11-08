import { render } from "@testing-library/react-native";

import ArrivalLandmarkGuidance from "../ArrivalLandmarkGuidance";

it("shows the named arrival point and its specific entrance directions", async () => {
  const screen = await render(
    <ArrivalLandmarkGuidance
      landmark={{
        id: 12,
        name: "Roadside reference",
        latitude: 10.3,
        longitude: 123.9,
        access_directions: "Follow the lane to the green gate.",
      }}
    />,
  );
  expect(screen.getByText("Continue via Roadside reference")).toBeTruthy();
  expect(screen.getByText("Follow the lane to the green gate.")).toBeTruthy();
  expect(screen.getByText(/not a calculated walking route/)).toBeTruthy();
});
