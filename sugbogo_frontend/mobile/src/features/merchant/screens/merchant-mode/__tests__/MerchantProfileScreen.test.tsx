import React from "react";
import { act, fireEvent, render, within } from "@testing-library/react-native";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import Toast from "react-native-toast-message";

import MerchantProfileScreen from "../MerchantProfileScreen";

const mockRefetch = jest.fn();
const mockProfile = jest.fn();
const mockNotify = jest.fn();
const mockRequestState = jest.fn();
const mockClassificationState = jest.fn();
const mockLocationState = jest.fn();
const mockClusters = jest.fn();
const mockDocumentAccess = jest.fn();
const mockLogout = jest.fn();

jest.mock("@/features/auth/hooks/useLogout", () => ({
  useLogout: () => ({ logout: mockLogout }),
}));

jest.mock("../../../assets/icons/photos-card.svg", () => "PhotosCardIcon");
jest.mock(
  "../../../assets/icons/landmarks-card.svg",
  () => "LandmarksCardIcon",
);
jest.mock("../../../assets/icons/hours-card.svg", () => "HoursCardIcon");

jest.mock("@tanstack/react-query", () => ({
  useMutation: () => mockDocumentAccess(),
}));
jest.mock("expo-web-browser", () => ({
  openBrowserAsync: jest.fn(),
}));
jest.mock("react-native-toast-message", () => ({
  show: jest.fn(),
}));

jest.mock("@/shared/components/modals/ConfirmModal", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return function MockConfirmModal({
    visible,
    title,
    destructive,
    onCancel,
    onConfirm,
  }: {
    visible: boolean;
    title: string;
    destructive: boolean;
    onCancel: () => void;
    onConfirm: () => void;
  }) {
    if (!visible) return null;
    return (
      <View>
        <Text>{title}</Text>
        <Text>{destructive ? "Destructive confirmation" : "Confirmation"}</Text>
        <Pressable onPress={onCancel} accessibilityLabel="Cancel logout">
          <Text>Cancel</Text>
        </Pressable>
        <Pressable onPress={onConfirm} accessibilityLabel="Confirm logout">
          <Text>Confirm</Text>
        </Pressable>
      </View>
    );
  };
});

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
jest.mock("../../../hooks/registration/useClusters", () => ({
  __esModule: true,
  default: () => mockClusters(),
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
    clusterIcon,
  }: {
    businessName: string;
    status: string;
    clusterIcon?: string;
  }) {
    return (
      <>
        <Text>{businessName}</Text>
        <Text testID="cluster-icon-key">{clusterIcon ?? ""}</Text>
        <Text>{status === "active" ? "Active" : "Suspended"}</Text>
      </>
    );
  };
});

jest.mock(
  "../../../components/business-profile/MerchantProfileStickyHeader",
  () => {
    const { Pressable, Text, View } = jest.requireActual("react-native");
    return function MockStickyHeader({
      visible,
      businessName,
      onManageBusiness,
    }: {
      visible: boolean;
      businessName: string;
      onManageBusiness: () => void;
    }) {
      return (
        <View
          testID="merchant-profile-sticky-header"
          pointerEvents={visible ? "auto" : "none"}
        >
          {visible ? (
            <Pressable
              onPress={onManageBusiness}
              accessibilityLabel="Manage business from sticky header"
            >
              <Text>{businessName}</Text>
            </Pressable>
          ) : null}
        </View>
      );
    };
  },
);

jest.mock("../../../components/business-profile/MerchantBusinessStory", () => {
  const { Text } = jest.requireActual("react-native");
  return function MockStory() {
    return <Text>About your business</Text>;
  };
});

jest.mock(
  "../../../components/business-profile/MerchantBusinessDetails",
  () => {
    const { Pressable, Text, View } = jest.requireActual("react-native");
    return function MockOverview({
      onSwitchToExplorer,
      isSwitchingToExplorer,
      onViewMap,
      onViewDocument,
    }: {
      onSwitchToExplorer?: () => void;
      isSwitchingToExplorer?: boolean;
      onViewMap?: () => void;
      onViewDocument?: (documentId: number) => void;
    }) {
      return (
        <View>
          <Text>Business details</Text>
          <Pressable onPress={onViewMap} accessibilityLabel="View map">
            <Text>View map</Text>
          </Pressable>
          <Pressable
            onPress={() => onViewDocument?.(3)}
            accessibilityLabel="Open verification document"
          >
            <Text>Open document</Text>
          </Pressable>
          <Pressable
            onPress={onSwitchToExplorer}
            disabled={isSwitchingToExplorer}
            accessibilityState={{
              disabled: isSwitchingToExplorer,
              busy: isSwitchingToExplorer,
            }}
            testID="merchant-switch-to-explorer"
          >
            <Text>
              {isSwitchingToExplorer
                ? "Switching to Explorer..."
                : "Switch to Explorer"}
            </Text>
          </Pressable>
        </View>
      );
    };
  },
);

function showLoadedBusiness() {
  mockProfile.mockReturnValue({
    business: {
      id: 7,
      business_name: "Sugbo Bistro",
      category: { id: 1, name: "Restaurant" },
      cluster: { id: 1, name: "Culinary" },
      status: "active",
      display_cover_photo_url: null,
      cover_photo_update: { limit: 3, remaining: 1, resets_at: null },
      operating_hours: [],
      photos: [],
      specialty_tags: [],
      location: { landmarks: [] },
    },
    isLoading: false,
    error: null,
    refetch: mockRefetch,
  });
}

describe("MerchantProfileScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDocumentAccess.mockReturnValue({
      isPending: false,
      variables: undefined,
      mutateAsync: jest.fn(),
    });
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
    mockClusters.mockReturnValue({
      clusters: [{ id: 1, name: "Culinary", icon: "utensils" }],
    });
  });

  it("shows a noninteractive full-page skeleton only for a cold profile load", async () => {
    mockProfile.mockReturnValue({
      business: null,
      isLoading: true,
      error: null,
      refetch: mockRefetch,
    });

    const screen = await render(<MerchantProfileScreen />);

    expect(screen.getByTestId("merchant-profile-skeleton")).toBeTruthy();
    expect(screen.getByTestId("merchant-profile-skeleton-hero")).toBeTruthy();
    expect(
      screen.getByTestId("merchant-profile-skeleton-actions"),
    ).toBeTruthy();
    expect(
      screen.getByTestId("merchant-profile-skeleton-overview"),
    ).toBeTruthy();
    expect(
      screen.getByTestId("merchant-profile-skeleton-details"),
    ).toBeTruthy();
    expect(screen.getByTestId("merchant-profile-skeleton-more")).toBeTruthy();
    expect(
      screen.getByTestId("merchant-profile-skeleton-scroll").props
        .contentContainerStyle.paddingBottom,
    ).toBe(80);
    expect(screen.queryByText("Loading Business Profile")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("replaces the skeleton with business content after the initial fetch", async () => {
    mockProfile.mockReturnValue({
      business: null,
      isLoading: true,
      error: null,
      refetch: mockRefetch,
    });
    const screen = await render(<MerchantProfileScreen />);

    mockProfile.mockReturnValue({
      business: {
        id: 7,
        business_name: "Sugbo Bistro",
        category: { id: 1, name: "Restaurant" },
        cluster: { id: 1, name: "Culinary" },
        status: "active",
        display_cover_photo_url: null,
        cover_photo_update: { limit: 3, remaining: 1, resets_at: null },
        operating_hours: [],
        photos: [],
        specialty_tags: [],
        location: { landmarks: [] },
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });
    await screen.rerender(<MerchantProfileScreen />);

    expect(screen.queryByTestId("merchant-profile-skeleton")).toBeNull();
    expect(screen.getByText("Sugbo Bistro")).toBeTruthy();
    expect(screen.getByText("Manage Business")).toBeTruthy();
  });

  it("keeps cached business content during background fetch and pull refresh", async () => {
    mockProfile.mockReturnValue({
      business: {
        id: 7,
        business_name: "Sugbo Bistro",
        category: { id: 1, name: "Restaurant" },
        cluster: { id: 1, name: "Culinary" },
        status: "active",
        display_cover_photo_url: null,
        cover_photo_update: { limit: 3, remaining: 1, resets_at: null },
        operating_hours: [],
        photos: [],
        specialty_tags: [],
        location: { landmarks: [] },
      },
      isLoading: true,
      error: null,
      refetch: mockRefetch,
    });
    const screen = await render(<MerchantProfileScreen />);
    const scroll = screen.getByTestId("merchant-profile-scroll");

    expect(screen.queryByTestId("merchant-profile-skeleton")).toBeNull();
    expect(screen.getByText("Sugbo Bistro")).toBeTruthy();

    await act(async () => {
      await scroll.props.refreshControl.props.onRefresh();
    });

    expect(mockRefetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Sugbo Bistro")).toBeTruthy();
    expect(screen.queryByTestId("merchant-profile-skeleton")).toBeNull();
  });

  it("uses the Explorer logout row and confirmation flow", async () => {
    mockProfile.mockReturnValue({
      business: {
        id: 7,
        business_name: "Sugbo Bistro",
        category: { id: 1, name: "Restaurant" },
        cluster: { id: 1, name: "Culinary" },
        status: "active",
        cover_photo_url: null,
        cover_photo_update: { limit: 3, remaining: 1, resets_at: null },
        operating_hours: [],
        photos: [],
        specialty_tags: [],
        location: { landmarks: [] },
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    const screen = await render(<MerchantProfileScreen />);
    await fireEvent.press(screen.getByText("Logout"));
    expect(screen.getByText("Log out?")).toBeTruthy();

    expect(screen.getByText("Destructive confirmation")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Cancel logout"));
    expect(mockLogout).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText("Logout"));
    await fireEvent.press(screen.getByLabelText("Confirm logout"));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it("opens the approved map and a freshly authorized document", async () => {
    const mutateAsync = jest.fn().mockResolvedValue({
      url: "https://example.com/short-lived-preview",
      expires_in: 120,
    });
    mockDocumentAccess.mockReturnValue({
      isPending: false,
      variables: undefined,
      mutateAsync,
    });
    mockProfile.mockReturnValue({
      business: {
        id: 7,
        business_name: "Sugbo Bistro",
        category: { id: 1, name: "Restaurant" },
        cluster: { id: 1, name: "Culinary" },
        status: "active",
        cover_photo_url: null,
        cover_photo_update: { limit: 3, remaining: 1, resets_at: null },
        operating_hours: [],
        photos: [],
        specialty_tags: [],
        location: { landmarks: [] },
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    const screen = await render(<MerchantProfileScreen />);
    await fireEvent.press(screen.getByLabelText("View map"));
    expect(router.push).toHaveBeenCalledWith(
      "/(merchant)/business-location-map",
    );

    await fireEvent.press(screen.getByLabelText("Open verification document"));
    expect(mutateAsync).toHaveBeenCalledWith(3);
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      "https://example.com/short-lived-preview",
    );
  });

  it("shows an error when document access cannot be prepared", async () => {
    mockDocumentAccess.mockReturnValue({
      isPending: false,
      variables: undefined,
      mutateAsync: jest.fn().mockRejectedValue(new Error("Unavailable")),
    });
    mockProfile.mockReturnValue({
      business: {
        id: 7,
        business_name: "Sugbo Bistro",
        category: { id: 1, name: "Restaurant" },
        cluster: { id: 1, name: "Culinary" },
        status: "active",
        cover_photo_url: null,
        cover_photo_update: { limit: 3, remaining: 1, resets_at: null },
        operating_hours: [],
        photos: [],
        specialty_tags: [],
        location: { landmarks: [] },
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    const screen = await render(<MerchantProfileScreen />);
    await fireEvent.press(screen.getByLabelText("Open verification document"));
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ text1: "Unable to open document" }),
    );
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

  it("shows one name request only in the central review section", async () => {
    mockProfile.mockReturnValue({
      business: {
        id: 7,
        business_name: "Sugbo Bistro",
        category: { id: 1, name: "Restaurant" },
        cluster: { id: 1, name: "Culinary" },
        status: "active",
        cover_photo_url: null,
        cover_photo_update: { limit: 3, remaining: 1, resets_at: null },
        operating_hours: [],
        photos: [],
        specialty_tags: [],
        location: { landmarks: [] },
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
    expect(screen.getByText("Changes under review")).toBeTruthy();
    const pending = screen.getByLabelText("View 1 change under review");
    expect(within(pending).getByText("1")).toBeTruthy();
    expect(within(pending).getByText("Business name")).toBeTruthy();
    expect(screen.queryByText("Name change pending")).toBeNull();
    expect(screen.queryByText("Awaiting Admin review")).toBeNull();
    expect(screen.queryByText("Request name change")).toBeNull();
    expect(screen.getByText("Manage Business")).toBeTruthy();
    expect(screen.queryByText("Change Requests")).toBeNull();
    expect(screen.getByTestId("cluster-icon-key").props.children).toBe(
      "utensils",
    );
    await fireEvent.press(screen.getByLabelText("View 1 change under review"));
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
        operating_hours: [],
        photos: [],
        specialty_tags: [],
        location: { landmarks: [] },
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
    expect(screen.queryByText(/changes under review/)).toBeNull();
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
    );
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
        operating_hours: [],
        photos: [],
        specialty_tags: [],
        location: { landmarks: [] },
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    const screen = await render(<MerchantProfileScreen />);
    const actions = screen.getByTestId("merchant-profile-actions");
    expect(within(actions).getByText("Preview as Explorer")).toBeTruthy();
    expect(within(actions).getByText("Manage Business")).toBeTruthy();
    expect(screen.queryByText(/changes under review/)).toBeNull();
    expect(screen.queryByText("Name change pending")).toBeNull();
    expect(screen.queryByText("Change Requests")).toBeNull();
    await fireEvent.press(screen.getByText("Manage Business"));
    expect(router.push).toHaveBeenCalledWith("/(merchant)/manage-business");
    await fireEvent.press(screen.getByText("Switch to Explorer"));
    expect(router.replace).toHaveBeenCalledWith("/(explorer)/(tabs)/explore");
    expect(screen.getByText("Switching to Explorer...")).toBeTruthy();
    expect(
      screen.getByTestId("merchant-switch-to-explorer").props
        .accessibilityState,
    ).toEqual({ disabled: true, busy: true });
    await fireEvent.press(screen.getByTestId("merchant-switch-to-explorer"));
    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  it("reveals compact business identity after the hero scrolls away", async () => {
    mockProfile.mockReturnValue({
      business: {
        id: 7,
        business_name: "Sugbo Bistro",
        category: { id: 1, name: "Restaurant" },
        cluster: { id: 1, name: "Culinary" },
        status: "active",
        cover_photo_url: null,
        cover_photo_update: { limit: 3, remaining: 1, resets_at: null },
        operating_hours: [],
        photos: [],
        specialty_tags: [],
        location: { landmarks: [] },
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    const screen = await render(<MerchantProfileScreen />);
    const sticky = screen.getByTestId("merchant-profile-sticky-header");
    const scroll = screen.getByTestId("merchant-profile-scroll");

    expect(sticky.props.pointerEvents).toBe("none");
    await fireEvent(
      screen.getByTestId("merchant-profile-hero-container"),
      "onLayout",
      {
        nativeEvent: { layout: { height: 304 } },
      },
    );
    await fireEvent.scroll(scroll, {
      nativeEvent: { contentOffset: { y: 200 } },
    });
    expect(sticky.props.pointerEvents).toBe("none");
    await fireEvent.scroll(scroll, {
      nativeEvent: { contentOffset: { y: 250 } },
    });
    expect(
      screen.getByTestId("merchant-profile-sticky-header").props.pointerEvents,
    ).toBe("auto");
    await fireEvent.press(
      screen.getByLabelText("Manage business from sticky header"),
    );
    expect(router.push).toHaveBeenCalledWith("/(merchant)/manage-business");
    await fireEvent.scroll(scroll, {
      nativeEvent: { contentOffset: { y: 0 } },
    });
    expect(
      screen.getByTestId("merchant-profile-sticky-header").props.pointerEvents,
    ).toBe("none");
  });

  it("consolidates multiple pending changes without section detail links", async () => {
    mockProfile.mockReturnValue({
      business: {
        id: 7,
        business_name: "Sugbo Bistro",
        category: { id: 1, name: "Restaurant" },
        cluster: { id: 1, name: "Culinary" },
        status: "active",
        cover_photo_url: null,
        cover_photo_update: { limit: 3, remaining: 1, resets_at: null },
        operating_hours: [],
        photos: [],
        specialty_tags: [],
        location: { landmarks: [] },
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
    expect(screen.getByText("Changes under review")).toBeTruthy();
    const pending = screen.getByLabelText("View 2 changes under review");
    expect(within(pending).getByText("2")).toBeTruthy();
    expect(
      within(pending).getByText("Classification · Location & landmarks"),
    ).toBeTruthy();
    expect(screen.queryByText("Classification Pending review")).toBeNull();
    expect(screen.queryByText("Location Pending review")).toBeNull();
    expect(screen.queryByText("Awaiting Admin review")).toBeNull();
    expect(screen.queryByText("Change Requests")).toBeNull();
    await fireEvent.press(screen.getByLabelText("View 2 changes under review"));
    expect(router.push).toHaveBeenCalledWith("/(merchant)/change-requests");
    await fireEvent.press(screen.getByText("Preview as Explorer"));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(explorer)/business/[businessId]",
      params: { businessId: "7", previewAsExplorer: "1" },
    });
  });

  it.each([
    [
      "classification",
      11,
      "/(merchant)/business-update-requests/classification/11",
    ],
    ["location", 22, "/(merchant)/business-update-requests/location/22"],
  ])(
    "opens one %s request from the central section",
    async (type, id, href) => {
      mockProfile.mockReturnValue({
        business: {
          id: 7,
          business_name: "Sugbo Bistro",
          category: { id: 1, name: "Restaurant" },
          cluster: { id: 1, name: "Culinary" },
          status: "active",
          cover_photo_url: null,
          cover_photo_update: { limit: 3, remaining: 1, resets_at: null },
          operating_hours: [],
          photos: [],
          specialty_tags: [],
          location: { landmarks: [] },
        },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });
      const requestState = {
        pendingRequest: { id },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      };
      if (type === "classification") {
        mockClassificationState.mockReturnValue(requestState);
      } else {
        mockLocationState.mockReturnValue(requestState);
      }

      const screen = await render(<MerchantProfileScreen />);
      expect(screen.getByText("Changes under review")).toBeTruthy();
      expect(screen.queryByText("Awaiting Admin review")).toBeNull();
      const pending = screen.getByLabelText("View 1 change under review");
      expect(within(pending).getByText("1")).toBeTruthy();
      expect(
        within(pending).getByText(
          type === "location" ? "Location & landmarks" : "Classification",
        ),
      ).toBeTruthy();
      await fireEvent.press(
        screen.getByLabelText("View 1 change under review"),
      );
      expect(router.push).toHaveBeenCalledWith(href);
    },
  );

  it("shows the actual count when all three changes are pending", async () => {
    mockProfile.mockReturnValue({
      business: {
        id: 7,
        business_name: "Sugbo Bistro",
        category: { id: 1, name: "Restaurant" },
        cluster: { id: 1, name: "Culinary" },
        status: "active",
        cover_photo_url: null,
        cover_photo_update: { limit: 3, remaining: 1, resets_at: null },
        operating_hours: [],
        photos: [],
        specialty_tags: [],
        location: { landmarks: [] },
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });
    mockRequestState.mockReturnValue({
      pendingRequest: { id: 9 },
      refetch: jest.fn(),
    });
    mockClassificationState.mockReturnValue({
      pendingRequest: { id: 11 },
      refetch: jest.fn(),
    });
    mockLocationState.mockReturnValue({
      pendingRequest: { id: 22 },
      refetch: jest.fn(),
    });

    const screen = await render(<MerchantProfileScreen />);
    expect(screen.getByText("Changes under review")).toBeTruthy();
    const pending = screen.getByLabelText("View 3 changes under review");
    expect(within(pending).getByText("3")).toBeTruthy();
    expect(
      within(pending).getByText(
        "Business name · Classification · Location & landmarks",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Name change pending")).toBeNull();
    expect(screen.queryByText("Classification Pending review")).toBeNull();
    expect(screen.queryByText("Location Pending review")).toBeNull();
    await fireEvent.press(screen.getByLabelText("View 3 changes under review"));
    expect(router.push).toHaveBeenCalledWith("/(merchant)/change-requests");
  });

  it("keeps cached pending data visible during a background refetch", async () => {
    mockProfile.mockReturnValue({
      business: {
        id: 7,
        business_name: "Sugbo Bistro",
        category: { id: 1, name: "Restaurant" },
        cluster: { id: 1, name: "Culinary" },
        status: "active",
        cover_photo_url: null,
        cover_photo_update: { limit: 3, remaining: 1, resets_at: null },
        operating_hours: [],
        photos: [],
        specialty_tags: [],
        location: { landmarks: [] },
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });
    mockLocationState.mockReturnValue({
      pendingRequest: { id: 22 },
      isLoading: false,
      isRefetching: true,
      error: null,
      refetch: jest.fn(),
    });

    const screen = await render(<MerchantProfileScreen />);
    expect(screen.getByText("Changes under review")).toBeTruthy();
    const pending = screen.getByLabelText("View 1 change under review");
    expect(within(pending).getByText("1")).toBeTruthy();
    expect(within(pending).getByText("Location & landmarks")).toBeTruthy();
    expect(screen.queryByText("Checking request status...")).toBeNull();
  });

  it("preserves a retry action when request status fails", async () => {
    const refetchLocation = jest.fn();
    mockProfile.mockReturnValue({
      business: {
        id: 7,
        business_name: "Sugbo Bistro",
        category: { id: 1, name: "Restaurant" },
        cluster: { id: 1, name: "Culinary" },
        status: "active",
        cover_photo_url: null,
        cover_photo_update: { limit: 3, remaining: 1, resets_at: null },
        operating_hours: [],
        photos: [],
        specialty_tags: [],
        location: { landmarks: [] },
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });
    mockLocationState.mockReturnValue({
      pendingRequest: null,
      isLoading: false,
      error: new Error("Request status unavailable"),
      refetch: refetchLocation,
    });

    const screen = await render(<MerchantProfileScreen />);
    expect(screen.queryByText("Changes under review")).toBeNull();
    expect(screen.getByText("Unable to check update requests")).toBeTruthy();
    await fireEvent.press(
      screen.getByLabelText("Unable to check update requests. Tap to retry."),
    );
    expect(refetchLocation).toHaveBeenCalledTimes(1);
  });

  it("shows a compact status placeholder until the independent queries resolve", async () => {
    showLoadedBusiness();
    mockRequestState.mockReturnValue({
      pendingRequest: null,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });
    mockClassificationState.mockReturnValue({
      pendingRequest: null,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });
    mockLocationState.mockReturnValue({
      pendingRequest: null,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });

    const screen = await render(<MerchantProfileScreen />);
    expect(screen.getByTestId("merchant-request-status-skeleton")).toBeTruthy();
    expect(screen.getByText("Sugbo Bistro")).toBeTruthy();
    expect(screen.queryByText("Changes under review")).toBeNull();

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
    await screen.rerender(<MerchantProfileScreen />);
    expect(screen.queryByTestId("merchant-request-status-skeleton")).toBeNull();
    expect(screen.queryByText("Changes under review")).toBeNull();
    expect(screen.queryByText("Unable to check update requests")).toBeNull();
  });

  it("retains confirmed pending navigation and retries only a failed status", async () => {
    showLoadedBusiness();
    const error = new Error("Classification status unavailable");
    const refetchName = jest.fn();
    const refetchClassification = jest.fn();
    const refetchLocation = jest.fn();
    mockRequestState.mockReturnValue({
      pendingRequest: { id: 9 },
      isLoading: false,
      error: null,
      refetch: refetchName,
    });
    mockClassificationState.mockReturnValue({
      pendingRequest: null,
      isLoading: false,
      error,
      refetch: refetchClassification,
    });
    mockLocationState.mockReturnValue({
      pendingRequest: null,
      isLoading: false,
      error: null,
      refetch: refetchLocation,
    });

    const screen = await render(<MerchantProfileScreen />);
    const pending = screen.getByLabelText("View confirmed change under review");
    expect(within(pending).getByText("Business name")).toBeTruthy();
    expect(within(pending).queryByText("1")).toBeNull();
    expect(screen.getByText("Unable to check update requests")).toBeTruthy();
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        error,
        toastId: "merchant-profile-change-request-status-error",
      }),
    );
    await fireEvent.press(pending);
    expect(router.push).toHaveBeenCalledWith(
      "/(merchant)/business-update-requests/9",
    );
    await fireEvent.press(
      screen.getByLabelText("Unable to check update requests. Tap to retry."),
    );
    expect(refetchClassification).toHaveBeenCalledTimes(1);
    expect(refetchName).not.toHaveBeenCalled();
    expect(refetchLocation).not.toHaveBeenCalled();

    mockClassificationState.mockReturnValue({
      pendingRequest: { id: 11 },
      isLoading: false,
      error: null,
      refetch: refetchClassification,
    });
    await screen.rerender(<MerchantProfileScreen />);
    expect(screen.queryByText("Unable to check update requests")).toBeNull();
    expect(screen.getByLabelText("View 2 changes under review")).toBeTruthy();
  });

  it("keeps a single error and targeted Retry for three failed queries", async () => {
    showLoadedBusiness();
    const error = new Error("Unavailable");
    const refetchName = jest.fn();
    const refetchClassification = jest.fn();
    const refetchLocation = jest.fn();
    mockRequestState.mockReturnValue({
      pendingRequest: null,
      isLoading: false,
      error,
      refetch: refetchName,
    });
    mockClassificationState.mockReturnValue({
      pendingRequest: null,
      isLoading: false,
      error,
      refetch: refetchClassification,
    });
    mockLocationState.mockReturnValue({
      pendingRequest: null,
      isLoading: false,
      error,
      refetch: refetchLocation,
    });

    const screen = await render(<MerchantProfileScreen />);
    expect(screen.getAllByText("Unable to check update requests")).toHaveLength(
      1,
    );
    expect(screen.getByText("Business details")).toBeTruthy();
    await fireEvent.press(
      screen.getByLabelText("Unable to check update requests. Tap to retry."),
    );
    expect(refetchName).toHaveBeenCalledTimes(1);
    expect(refetchClassification).toHaveBeenCalledTimes(1);
    expect(refetchLocation).toHaveBeenCalledTimes(1);
    await screen.rerender(<MerchantProfileScreen />);
    expect(screen.getByText("Unable to check update requests")).toBeTruthy();

    mockLocationState.mockReturnValue({
      pendingRequest: null,
      isLoading: false,
      isRefetching: true,
      error,
      refetch: refetchLocation,
    });
    await screen.rerender(<MerchantProfileScreen />);
    expect(screen.getByText("Checking request statuses...")).toBeTruthy();
    expect(screen.queryByText("Tap to retry")).toBeNull();
  });

  it("keeps cached pending data visible when its background refresh fails", async () => {
    showLoadedBusiness();
    mockLocationState.mockReturnValue({
      pendingRequest: { id: 22 },
      isLoading: false,
      isRefetching: false,
      error: new Error("Refresh failed"),
      refetch: jest.fn(),
    });

    const screen = await render(<MerchantProfileScreen />);
    const pending = screen.getByLabelText("View confirmed change under review");
    expect(within(pending).getByText("Location & landmarks")).toBeTruthy();
    expect(within(pending).queryByText("1")).toBeNull();
    expect(screen.getByText("Unable to check update requests")).toBeTruthy();
    await fireEvent.press(pending);
    expect(router.push).toHaveBeenCalledWith(
      "/(merchant)/business-update-requests/location/22",
    );
  });
});
