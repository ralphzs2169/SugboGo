import { fireEvent, render } from "@testing-library/react-native";

import BusinessVisitInfoContent from "../BusinessVisitInfoContent";
import useUserLocation from "@/shared/hooks/useUserLocation";
import useDirectJourneys from "../../../hooks/useDirectJourneys";

jest.mock("@/shared/hooks/useUserLocation");
jest.mock("../BusinessVisitMapPreview", () => () => null);
jest.mock("../../../hooks/useDirectJourneys");
jest.mock("expo-router", () => ({
  useNavigation: () => ({ isFocused: () => true }),
}));

jest.mock("../../../utils/businessHours.utils", () => ({
  getBusinessHoursSummary: () => ({
    isOpen: true,
    label: "Open now · Until 8 PM",
  }),
  formatTime: (value: string) => value,
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

  it("keeps merchant notes readable in saved visit details with transport disabled", async () => {
    const screen = await render(
      <BusinessVisitInfoContent
        {...defaultProps}
        readOnly
        accessDirections="Walk behind the chapel."
      />,
    );
    expect(screen.getByText("Walk behind the chapel.")).toBeTruthy();
    expect(screen.getByText("Merchant-provided directions")).toBeTruthy();
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
