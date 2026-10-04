import React from "react";
import { fireEvent, render, within } from "@testing-library/react-native";
import { router } from "expo-router";

import MerchantProfileScreen from "../MerchantProfileScreen";

const mockRefetch = jest.fn();
const mockProfile = jest.fn();
const mockNotify = jest.fn();
const mockRequestState = jest.fn();
const mockClassificationState = jest.fn();
const mockLocationState = jest.fn();

jest.mock("../../../hooks/business-profile/useMerchantBusinessProfile", () => ({
  __esModule: true,
  default: () => mockProfile(),
}));

jest.mock(
  "../../../hooks/business-name-change/useMerchantBusinessNameChanges",
  () => ({
    useMerchantBusinessNameChangeRequests: () => mockRequestState(),
  }),
);
jest.mock(
  "../../../hooks/classification-change/useMerchantClassificationChanges",
  () => ({
    useMerchantClassificationChangeRequests: () => mockClassificationState(),
  }),
);
jest.mock("../../../hooks/location-change/useMerchantLocationChanges", () => ({
  useMerchantLocationChangeRequests: () => mockLocationState(),
}));

jest.mock(
  "../../../hooks/business-profile/useUpdateBusinessCoverPhoto",
  () => ({
    __esModule: true,
    default: () => ({ updateCoverPhoto: jest.fn(), isUploading: false }),
  }),
);

jest.mock("@/shared/hooks/useQueryErrorNotification", () => ({
  __esModule: true,
  default: (options: unknown) => mockNotify(options),
}));

jest.mock("@/shared/hooks/useTabBarSpacing", () => ({
  useTabBarSpacing: () => 80,
}));

jest.mock("@/features/app-mode/store/appMode.store", () => ({
  useAppModeStore: (selector: (state: unknown) => unknown) =>
    selector({ setActiveMode: jest.fn() }),
}));

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn() },
  useNavigation: () => ({ isFocused: () => true }),
}));

jest.mock("../../../components/business-profile/MerchantProfileHeader", () => {
  const { Text } = jest.requireActual("react-native");
  return function MockHeader({
    businessName,
    status,
  }: {
    businessName: string;
    status: string;
  }) {
    return (
      <>
        <Text>{businessName}</Text>
        <Text>{status === "active" ? "Active" : "Suspended"}</Text>
      </>
    );
  };
});

jest.mock(
  "../../../components/business-profile/MerchantBusinessOverview",
  () => {
    const { Pressable, Text, View } = jest.requireActual("react-native");
    return function MockOverview({
      pendingClassificationRequest,
      pendingLocationRequest,
      onClassificationHistory,
      onLocationHistory,
      onSwitchToExplorer,
    }: {
      pendingClassificationRequest?: { id: number };
      pendingLocationRequest?: { id: number };
      onClassificationHistory?: () => void;
      onLocationHistory?: () => void;
      onSwitchToExplorer?: () => void;
    }) {
      return (
        <View>
          <Text>Business details</Text>
          {pendingClassificationRequest ? (
            <Pressable onPress={onClassificationHistory}>
              <Text>Classification Pending</Text>
            </Pressable>
          ) : null}
          {pendingLocationRequest ? (
            <Pressable onPress={onLocationHistory}>
              <Text>Location Pending</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onSwitchToExplorer}>
            <Text>Switch to Explorer</Text>
          </Pressable>
        </View>
      );
    };
  },
);

describe("MerchantProfileScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRefetch.mockResolvedValue({ data: null, error: null });
    mockRequestState.mockReturnValue({
      pendingRequest: null,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockClassificationState.mockReturnValue({
      pendingRequest: null,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockLocationState.mockReturnValue({
      pendingRequest: null,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  it("keeps a persistent error and retries the profile query", async () => {
    const error = new Error("Network unavailable");
    mockProfile.mockReturnValue({
      business: null,
      isLoading: false,
      error,
      refetch: mockRefetch,
    });

    const screen = await render(<MerchantProfileScreen />);

    expect(screen.getByText("Unable to load business profile")).toBeTruthy();
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ error }));

    await fireEvent.press(screen.getByText("Try Again"));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("shows a pending request without replacing the live business name", async () => {
    mockProfile.mockReturnValue({
      business: {
        id: 7,
        business_name: "Sugbo Bistro",
        category: { id: 1, name: "Restaurant" },
        cluster: { id: 1, name: "Culinary" },
        status: "active",
        cover_photo_url: null,
        cover_photo_update: { limit: 3, remaining: 1, resets_at: null },
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });
    mockRequestState.mockReturnValue({
      pendingRequest: {
        id: 9,
        proposed_business_name: "Sugbo Heritage Bistro",
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const screen = await render(<MerchantProfileScreen />);
    expect(screen.getByText("Sugbo Bistro")).toBeTruthy();
    expect(screen.getAllByText("Sugbo Bistro")).toHaveLength(1);
    expect(screen.getByText("Pending change")).toBeTruthy();
    expect(screen.getByText("Business name")).toBeTruthy();
    expect(screen.queryByText("Request name change")).toBeNull();
    expect(screen.getByText("Manage Business")).toBeTruthy();
    expect(screen.queryByText("Change Requests")).toBeNull();
    await fireEvent.press(
      screen.getByLabelText("View pending Business name request"),
    );
    expect(router.push).toHaveBeenCalledWith(
      "/(merchant)/business-update-requests/9",
    );
  });

  it("keeps cached business content visible after a refetch error", async () => {
    mockProfile.mockReturnValue({
      business: {
        id: 7,
        business_name: "Sugbo Bistro",
        category: { id: 1, name: "Restaurant" },
        cluster: { id: 1, name: "Culinary" },
        status: "suspended",
        cover_photo_url: null,
        cover_photo_update: { limit: 3, remaining: 1, resets_at: null },
      },
      isLoading: false,
      error: new Error("Refetch failed"),
      refetch: mockRefetch,
    });

    const screen = await render(<MerchantProfileScreen />);

    expect(screen.getByText("Business details")).toBeTruthy();
    expect(screen.getByText("Suspended")).toBeTruthy();
    expect(screen.queryByText("Request name change")).toBeNull();
    expect(screen.getByText("Manage Business")).toBeTruthy();
    expect(screen.queryByText("Pending change")).toBeNull();
    expect(mockNotify).toHaveBeenCalledTimes(1);
  });

  it("keeps the two primary actions in one compact row", async () => {
    mockProfile.mockReturnValue({
      business: {
        id: 7,
        business_name: "Sugbo Bistro",
        category: { id: 1, name: "Restaurant" },
        cluster: { id: 1, name: "Culinary" },
        status: "active",
        cover_photo_url: null,
        cover_photo_update: { limit: 3, remaining: 1, resets_at: null },
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    const screen = await render(<MerchantProfileScreen />);
    const actions = screen.getByTestId("merchant-profile-actions");
    expect(within(actions).getByText("Preview as Explorer")).toBeTruthy();
    expect(within(actions).getByText("Manage Business")).toBeTruthy();
    expect(screen.queryByText("Pending change")).toBeNull();
    expect(screen.queryByText("Change Requests")).toBeNull();
    await fireEvent.press(screen.getByText("Manage Business"));
    expect(router.push).toHaveBeenCalledWith("/(merchant)/manage-business");
    await fireEvent.press(screen.getByText("Switch to Explorer"));
    expect(router.replace).toHaveBeenCalledWith("/(explorer)/(tabs)/explore");
  });

  it("consolidates multiple pending changes while keeping section detail links", async () => {
    mockProfile.mockReturnValue({
      business: {
        id: 7,
        business_name: "Sugbo Bistro",
        category: { id: 1, name: "Restaurant" },
        cluster: { id: 1, name: "Culinary" },
        status: "active",
        cover_photo_url: null,
        cover_photo_update: { limit: 3, remaining: 1, resets_at: null },
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });
    mockClassificationState.mockReturnValue({
      pendingRequest: { id: 11 },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockLocationState.mockReturnValue({
      pendingRequest: { id: 22 },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const screen = await render(<MerchantProfileScreen />);
    expect(screen.getByText("2 pending changes")).toBeTruthy();
    expect(screen.queryByText("Change Requests")).toBeNull();
    await fireEvent.press(screen.getByText("Classification Pending"));
    expect(router.push).toHaveBeenCalledWith(
      "/(merchant)/business-update-requests/classification/11",
    );
    await fireEvent.press(screen.getByText("Location Pending"));
    expect(router.push).toHaveBeenCalledWith(
      "/(merchant)/business-update-requests/location/22",
    );
    await fireEvent.press(screen.getByLabelText("View 2 pending changes"));
    expect(router.push).toHaveBeenCalledWith("/(merchant)/change-requests");
    await fireEvent.press(screen.getByText("Preview as Explorer"));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(explorer)/business/[businessId]",
      params: { businessId: "7", previewAsExplorer: "1" },
    });
  });
});
