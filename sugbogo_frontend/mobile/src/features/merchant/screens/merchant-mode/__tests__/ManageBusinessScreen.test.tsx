import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  within,
} from "@testing-library/react-native";

import ManageBusinessScreen from "../ManageBusinessScreen";

const mockPush = jest.fn();
const mockProfile = jest.fn();
const mockPendingStatus = jest.fn();

jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  useFocusEffect: (callback: () => void) =>
    jest.requireActual("react").useEffect(callback, [callback]),
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("../../../hooks/business-profile/useMerchantBusinessProfile", () => ({
  __esModule: true,
  default: () => mockProfile(),
}));
jest.mock(
  "../../../hooks/change-requests/useBusinessChangePendingStatus",
  () => ({
    __esModule: true,
    default: () => mockPendingStatus(),
  }),
);

const business = {
  status: "active",
  business_name: "Sugbo Bistro",
  category: { name: "Cafe" },
  cluster: { name: "Culinary" },
  location: { address: "Osmeña Boulevard" },
  photos: [],
};

describe("ManageBusinessScreen", () => {
  afterEach(async () => {
    await cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockProfile.mockReturnValue({
      business,
      isLoading: false,
      refetch: jest.fn(),
    });
    mockPendingStatus.mockReturnValue({
      pendingStatus: null,
      refetch: jest.fn(),
    });
  });

  it("shows grouped navigation placeholders while the profile cold-loads", async () => {
    mockProfile.mockReturnValue({
      business: null,
      isLoading: true,
      refetch: jest.fn(),
    });
    const screen = await render(<ManageBusinessScreen />);
    expect(screen.getByTestId("manage-business-skeleton")).toBeTruthy();
    expect(screen.queryByText("Business details")).toBeNull();
  });

  it("keeps cached navigation available during a profile refetch", async () => {
    mockProfile.mockReturnValue({
      business,
      isLoading: true,
      refetch: jest.fn(),
    });
    const screen = await render(<ManageBusinessScreen />);
    expect(screen.queryByTestId("manage-business-skeleton")).toBeNull();
    expect(screen.getByText("Business details")).toBeTruthy();
  });

  it.each([
    ["business_name", "View business name requests"],
    ["classification", "View classification requests"],
    ["location", "View location & landmarks requests"],
  ] as const)("shows Pending only for %s", async (pendingKey, rowLabel) => {
    mockPendingStatus.mockReturnValue({
      pendingStatus: {
        business_name: pendingKey === "business_name",
        classification: pendingKey === "classification",
        location: pendingKey === "location",
      },
      refetch: jest.fn(),
    });
    const screen = await render(<ManageBusinessScreen />);
    expect(
      within(screen.getByLabelText(rowLabel)).getByText("Pending"),
    ).toBeTruthy();
    expect(screen.getAllByText("Pending")).toHaveLength(1);
  });

  it("shows independent indicators for multiple pending requests", async () => {
    mockPendingStatus.mockReturnValue({
      pendingStatus: {
        business_name: true,
        classification: false,
        location: true,
      },
      refetch: jest.fn(),
    });
    const screen = await render(<ManageBusinessScreen />);
    expect(screen.getAllByText("Pending")).toHaveLength(2);
    expect(
      within(screen.getByLabelText("View classification requests")).queryByText(
        "Pending",
      ),
    ).toBeNull();
  });

  it("shows all three indicators when every request type is pending", async () => {
    mockPendingStatus.mockReturnValue({
      pendingStatus: {
        business_name: true,
        classification: true,
        location: true,
      },
      refetch: jest.fn(),
    });
    const screen = await render(<ManageBusinessScreen />);
    expect(screen.getAllByText("Pending")).toHaveLength(3);
  });

  it("shows no indicators when the backend confirms no pending requests", async () => {
    mockPendingStatus.mockReturnValue({
      pendingStatus: {
        business_name: false,
        classification: false,
        location: false,
      },
      refetch: jest.fn(),
    });
    const screen = await render(<ManageBusinessScreen />);
    expect(screen.queryByText("Pending")).toBeNull();
  });

  it("keeps navigation available without pending status data", async () => {
    const screen = await render(<ManageBusinessScreen />);
    expect(screen.queryByText("Pending")).toBeNull();
    await fireEvent.press(screen.getByLabelText("View business name requests"));
    expect(mockPush).toHaveBeenCalledWith(
      "/(merchant)/business-update-requests",
    );
  });

  it("opens each reviewed-change history directly", async () => {
    const screen = await render(<ManageBusinessScreen />);

    await fireEvent.press(screen.getByLabelText("View business name requests"));
    await fireEvent.press(
      screen.getByLabelText("View classification requests"),
    );
    await fireEvent.press(
      screen.getByLabelText("View location & landmarks requests"),
    );

    expect(mockPush.mock.calls.map(([route]) => route)).toEqual([
      "/(merchant)/business-update-requests",
      "/(merchant)/business-update-requests/classification",
      "/(merchant)/business-update-requests/location",
    ]);
    expect(screen.queryByText("Updates")).toBeNull();
    expect(screen.queryByText("Request history")).toBeNull();
  });

  it("preserves direct editing routes", async () => {
    const screen = await render(<ManageBusinessScreen />);
    await fireEvent.press(screen.getByText("Business information"));
    await fireEvent.press(screen.getByText("Operating hours"));
    await fireEvent.press(screen.getByText("Photos"));
    expect(mockPush.mock.calls.map(([route]) => route)).toEqual([
      "/(merchant)/business-information",
      "/(merchant)/operating-hours",
      "/(merchant)/business-photos",
    ]);
  });

  it("allows suspended merchants to view history while direct editing stays disabled", async () => {
    mockProfile.mockReturnValue({
      business: { ...business, status: "suspended" },
      isLoading: false,
      refetch: jest.fn(),
    });
    const screen = await render(<ManageBusinessScreen />);
    expect(screen.getByText(/Changes are unavailable/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("View business name requests"));
    await fireEvent.press(
      screen.getByLabelText("View classification requests"),
    );
    await fireEvent.press(
      screen.getByLabelText("View location & landmarks requests"),
    );
    expect(mockPush).toHaveBeenCalledTimes(3);
    await fireEvent.press(screen.getByText("Business information"));
    expect(mockPush).toHaveBeenCalledTimes(3);
  });
});
