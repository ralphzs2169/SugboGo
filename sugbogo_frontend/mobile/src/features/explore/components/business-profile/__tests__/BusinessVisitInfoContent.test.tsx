import { fireEvent, render } from "@testing-library/react-native";

import BusinessVisitInfoContent from "../BusinessVisitInfoContent";
import useUserLocation from "@/shared/hooks/useUserLocation";
import useDirectJourneys from "../../../hooks/useDirectJourneys";

jest.mock("@/shared/hooks/useUserLocation");
jest.mock("../BusinessVisitMapPreview", () => () => null);
jest.mock("../../../hooks/useDirectJourneys");
jest.mock("expo-router", () => ({
  useIsFocused: () => true,
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("../../../assets/getting-there-icons/jeep-route-option.svg", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native");

  return function MockJeepneyIcon() {
    return <View />;
  };
});
jest.mock(
  "../../../assets/getting-there-icons/route-map-option.svg",
  () => () => null,
);
jest.mock(
  "../../../assets/getting-there-icons/book-ride-option.svg",
  () => () => null,
);

const defaultProps = {
  location: {
    address: "123 Colon Street",
    city: "Cebu City",
    province: "Cebu",
    latitude: 10.3,
    longitude: 123.9,
  },
  operatingHours: [],
  contactNumber: "09171234567",
  email: null,
  website: null,
  onViewRoute: jest.fn(),
  onJeepneyGuide: jest.fn(),
  onRide: jest.fn(),
  isOwnBusiness: false,
};

describe("BusinessVisitInfoContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows contextual Route, Jeepney, and Ride actions", async () => {
    const screen = await render(<BusinessVisitInfoContent {...defaultProps} />);

    expect(screen.getByText("Road Route")).toBeTruthy();
    expect(screen.getByText("Jeepney")).toBeTruthy();
    expect(screen.getByText("Book a ride")).toBeTruthy();
    expect(useUserLocation).not.toHaveBeenCalled();
    expect(useDirectJourneys).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText("View road route"));
    await fireEvent.press(screen.getByLabelText("Open jeepney guide"));
    await fireEvent.press(screen.getByLabelText("Choose a ride provider"));

    expect(defaultProps.onViewRoute).toHaveBeenCalled();
    expect(defaultProps.onJeepneyGuide).toHaveBeenCalled();
    expect(defaultProps.onRide).toHaveBeenCalled();
  });

  it("hides Explorer transportation actions for the business owner", async () => {
    const screen = await render(
      <BusinessVisitInfoContent {...defaultProps} isOwnBusiness />,
    );

    expect(screen.queryByLabelText("View road route")).toBeNull();
    expect(screen.queryByLabelText("Open jeepney guide")).toBeNull();
    expect(screen.queryByLabelText("Choose a ride provider")).toBeNull();
  });

  it("shows missing hours without claiming the business is closed", async () => {
    const screen = await render(<BusinessVisitInfoContent {...defaultProps} />);

    expect(screen.getByText("Hours unavailable")).toBeTruthy();
    expect(screen.queryByText("Closed")).toBeNull();
    expect(screen.queryByText("Open")).toBeNull();
  });

  it("places access context after location and before the three transport options", async () => {
    const screen = await render(
      <BusinessVisitInfoContent
        {...defaultProps}
        accessDirections="Use the blue gate."
      />,
    );
    expect(screen.getByRole("header", { name: "Access notes" })).toBeTruthy();
    expect(screen.getByText("Merchant-provided")).toBeTruthy();
    expect(screen.getByText("Use the blue gate.")).toBeTruthy();
    expect(screen.queryByText("How to reach us")).toBeNull();
    expect(
      screen.getAllByRole("button", {
        name: /View road route|Open jeepney guide|Choose a ride provider/,
      }),
    ).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Access notes" })).toBeNull();
    const content = JSON.stringify(screen.toJSON());
    expect(content.indexOf("123 Colon Street")).toBeLessThan(
      content.indexOf("Access notes"),
    );
    expect(content.indexOf("Access notes")).toBeLessThan(
      content.indexOf("How to get there"),
    );
  });

  it.each([undefined, "", " \n "])(
    "hides blank access context (%s)",
    async (directions) => {
      const screen = await render(
        <BusinessVisitInfoContent
          {...defaultProps}
          accessDirections={directions}
        />,
      );
      expect(screen.queryByText("Access notes")).toBeNull();
      expect(
        screen.getAllByRole("button", {
          name: /View road route|Open jeepney guide|Choose a ride provider/,
        }),
      ).toHaveLength(3);
    },
  );

  it("offers Read more only when access notes exceed the line preview", async () => {
    const directions = "Walk behind the chapel.\nUse the side gate.";
    const screen = await render(
      <BusinessVisitInfoContent
        {...defaultProps}
        accessDirections={directions}
      />,
    );
    expect(screen.queryByText("Read more")).toBeNull();
    await fireEvent(screen.getByText(directions), "textLayout", {
      nativeEvent: { lines: Array(5).fill({ text: "A rendered line" }) },
    });
    await fireEvent.press(screen.getByText("Read more"));
    expect(screen.getByText(directions).props.numberOfLines).toBeUndefined();
  });

  it("keeps merchant notes readable in saved visit details with transport disabled", async () => {
    const screen = await render(
      <BusinessVisitInfoContent
        {...defaultProps}
        readOnly
        accessDirections="Walk behind the chapel."
      />,
    );
    expect(screen.getByText("Walk behind the chapel.")).toBeTruthy();
    expect(screen.getByText("Merchant-provided")).toBeTruthy();
    expect(
      screen.getByLabelText("Open jeepney guide").props.accessibilityState
        .disabled,
    ).toBe(true);
    expect(useDirectJourneys).not.toHaveBeenCalled();
  });

  it("keeps saved visit information while disabling transport and avoiding a current-status claim", async () => {
    const screen = await render(
      <BusinessVisitInfoContent
        {...defaultProps}
        readOnly
        operatingHours={[
          {
            id: 1,
            day: "monday",
            is_open: true,
            is_24_hours: false,
            open_time: null,
            close_time: null,
          },
        ]}
      />,
    );
    expect(screen.getByText("123 Colon Street")).toBeTruthy();
    expect(screen.getByText("Previously loaded hours")).toBeTruthy();
    expect(screen.queryByText("Open")).toBeNull();
    expect(screen.queryByText("Closed")).toBeNull();
    for (const label of [
      "View road route",
      "Open jeepney guide",
      "Choose a ride provider",
    ]) {
      const button = screen.getByLabelText(label);
      expect(button.props.accessibilityState.disabled).toBe(true);
      await fireEvent.press(button);
    }
    expect(defaultProps.onViewRoute).not.toHaveBeenCalled();
    expect(defaultProps.onJeepneyGuide).not.toHaveBeenCalled();
    expect(defaultProps.onRide).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Show full business hours"));
    expect(screen.getByText("Hours not provided")).toBeTruthy();
  });
});
