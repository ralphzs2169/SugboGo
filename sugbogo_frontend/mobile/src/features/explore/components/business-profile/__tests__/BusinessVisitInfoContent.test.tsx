import { fireEvent, render } from "@testing-library/react-native";

import BusinessVisitInfoContent from "../BusinessVisitInfoContent";

jest.mock("../../../utils/businessHours.utils", () => ({
  getBusinessHoursSummary: () => ({
    isOpen: true,
    label: "Open now · Until 8 PM",
  }),
  formatTime: (value: string) => value,
}));
jest.mock(
  "../../../assets/getting-there-icons/jeepney-option.svg",
  () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { View } = require("react-native");

    return function MockJeepneyIcon() {
      return <View />;
    };
  },
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

    expect(screen.getByText("Getting there")).toBeTruthy();
    expect(screen.getByText("Route")).toBeTruthy();
    expect(screen.getByText("Jeepney")).toBeTruthy();
    expect(screen.getByText("Ride")).toBeTruthy();

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

    expect(screen.queryByText("Getting there")).toBeNull();
    expect(screen.queryByText("Route")).toBeNull();
    expect(screen.queryByText("Jeepney")).toBeNull();
    expect(screen.queryByText("Ride")).toBeNull();
  });
});
