import React, { type PropsWithChildren } from "react";

// Native screen initialization can exceed the default timeout on Windows.
jest.setTimeout(20000);
import { fireEvent, render, waitFor, act } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppState } from "react-native";
import { router } from "expo-router";

import ExploreScreen from "../ExploreScreen";
import ExploreBusinessProfileScreen from "../ExploreBusinessProfileScreen";
import useExploreBusinessProfile from "../../hooks/useExploreBusinessProfile";
import {
  recordBusinessImpressions,
  recordBusinessProfileVisit,
} from "../../api/exploreBusiness.service";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useIsFocused: () => true,
}));
jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: "denied" })),
  PermissionStatus: { GRANTED: "granted" },
}));
jest.mock("@/shared/hooks/useTabBarSpacing", () => ({
  useTabBarSpacing: () => 100,
}));
jest.mock("../../api/exploreBusiness.service", () => ({
  recordBusinessImpressions: jest.fn(),
  recordBusinessProfileVisit: jest.fn(),
}));
jest.mock("../../hooks/useExploreBusinessProfile");
jest.mock("../../hooks/useBusinessReviews", () => ({
  useBusinessReviewPreview: () => ({ totalCount: 0 }),
}));
jest.mock("../../hooks/useNewBusinesses", () => ({
  __esModule: true,
  default: () => ({
    businesses: [{
      id: 42,
      business_name: "Real business",
      location: { latitude: 10, longitude: 123 },
    }],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));
jest.mock("../../components/new-businesses/newBusinessCard", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ onPress }: { onPress: () => void }) =>
      <Text onPress={onPress}>Real business</Text>,
  };
});
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: require("react-native").View,
}));
jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: () => null,
}));
jest.mock("@gorhom/bottom-sheet", () => ({}));
jest.mock("../../components/ExploreTopBar", () => () => null);
jest.mock("../../components/hidden-gems/HiddenGemsSection", () => () => null);
jest.mock("../../components/interests/InterestsSection", () => () => null);
jest.mock("../../components/discover-more/DiscoverMoreSection", () => () => null);
jest.mock("../../components/trending/TrendingSection", () => () => null);
jest.mock("../../components/DiscoverNearYouButton", () => () => null);
jest.mock("@/shared/components/ErrorState", () => () => null);
jest.mock("@/shared/components/Skeleton", () => () => null);
jest.mock("@/shared/components/FixedFooter", () => () => null);
jest.mock("@/shared/components/modals/FullScreenPhotoViewer", () => () => null);
jest.mock("../../components/business-profile/ReviewComposerSheet", () => () => null);
jest.mock("../../components/business-profile/BusinessProfileQuickInfo", () => () => null);
jest.mock("../../components/business-profile/BusinessSpecialtiesSection", () => () => null);
jest.mock("../../components/business-profile/BusinessAboutContent", () => () => null);
jest.mock("../../components/business-profile/BusinessPhotosSection", () => () => null);
jest.mock("../../components/business-profile/review-section/BusinessReviewsSection", () => () => null);
jest.mock("../../components/business-profile/BusinessProfileSection", () => () => null);
jest.mock("../../components/business-profile/BusinessVisitInfoContent", () => () => null);
jest.mock("../../components/business-profile/BusinessProfileFooter", () => () => null);
jest.mock("../../components/business-profile/state/BusinessProfileErrorState", () => {
  const { Text } = require("react-native");
  return () => <Text>Profile load error</Text>;
});
jest.mock("../../components/business-profile/state/BusinessProfileSkeletonContent", () => {
  const { Text } = require("react-native");
  return () => <Text>Profile loading</Text>;
});
jest.mock("../../components/business-profile/ExploreBusinessHero", () => {
  const { Text } = require("react-native");
  return () => <Text>Displayed profile</Text>;
});

jest.mock("../../components/business-profile/BusinessProfileScrollView", () => {
  const { View } = require("react-native");
  return ({ children }: PropsWithChildren) => <View>{children}</View>;
});

function setup() {
  const client = new QueryClient({
    defaultOptions: { mutations: { gcTime: Infinity } },
  });

  /** Provides query state while leaf visuals are mocked for lifecycle tests. */
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  return { client, wrapper: Wrapper };
}

beforeEach(() => {
  AppState.currentState = "active";
  const failure = { success: false, code: "VALIDATION_ERROR" };
  (recordBusinessImpressions as jest.Mock).mockResolvedValue(failure);
  (recordBusinessProfileVisit as jest.Mock).mockResolvedValue(failure);
});

it("keeps nested Explore scrolling, refresh, and card navigation functional after telemetry failure", async () => {
  const { client, wrapper } = setup();
  const refresh = jest.spyOn(client, "refetchQueries");
  const screen = await render(<ExploreScreen />, { wrapper });
  const scrolls = [
    screen.getByTestId("explore-discovery-scroll"),
    screen.getByTestId("new-businesses-scroll"),
  ];
  expect(scrolls).toHaveLength(2);
  expect(recordBusinessImpressions).not.toHaveBeenCalled();

  // Supply native layout observations; API data alone did not record anything.
  await act(async () => {
    scrolls[0].props.onLayout({
      nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
    });
    screen.getByTestId("new-businesses-section").props.onLayout({
      nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 400 } },
    });
    scrolls[1].props.onLayout({
      nativeEvent: { layout: { x: 0, y: 50, width: 400, height: 300 } },
    });
    const cardContainer = screen.getByTestId("business-impression-42");
    cardContainer.props.onLayout({
      nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 300 } },
    });
  });
  await waitFor(() => {
    expect(recordBusinessImpressions).toHaveBeenCalledWith([42]);
  }, { timeout: 3000 });
  expect(screen.queryByText("Retry")).toBeNull();
  await fireEvent.press(screen.getByText("Real business"));
  expect(router.push).toHaveBeenCalledWith({
    pathname: "/(explorer)/business/[businessId]",
    params: { businessId: "42", distance: "", distanceAccuracy: "" },
  });
  await act(async () => {
    await scrolls[0].props.refreshControl.props.onRefresh();
  });
  expect(refresh).toHaveBeenCalledWith({ queryKey: ["explore-new-businesses"] });
});

it("records only displayed profile content and keeps it visible when tracking fails", async () => {
  const { wrapper } = setup();
  const profile = {
    business: null,
    isLoading: true,
    error: null,
    refetch: jest.fn(),
  };
  (useExploreBusinessProfile as jest.Mock).mockReturnValue(profile);
  const screen = await render(
    <ExploreBusinessProfileScreen businessId={42} distance={null} distanceAccuracy={null} />,
    { wrapper },
  );
  expect(screen.getByText("Profile loading")).toBeTruthy();
  expect(recordBusinessProfileVisit).not.toHaveBeenCalled();
  (useExploreBusinessProfile as jest.Mock).mockReturnValue({
    ...profile,
    isLoading: false,
    error: new Error("load failed"),
  });
  await screen.rerender(
    <ExploreBusinessProfileScreen businessId={42} distance={null} distanceAccuracy={null} />,
  );
  expect(screen.getByText("Profile load error")).toBeTruthy();
  expect(recordBusinessProfileVisit).not.toHaveBeenCalled();
  (useExploreBusinessProfile as jest.Mock).mockReturnValue({
    ...profile,
    isLoading: false,
    business: {
      id: 42,
      operating_hours: [],
      photos: [],
      specialty_tags: [],
      is_own_business: false,
    },
  });
  await screen.rerender(
    <ExploreBusinessProfileScreen businessId={42} distance={null} distanceAccuracy={null} />,
  );
  await waitFor(() => expect(recordBusinessProfileVisit).toHaveBeenCalledWith(42));
  expect(screen.getByText("Displayed profile")).toBeTruthy();
  await screen.rerender(
    <ExploreBusinessProfileScreen businessId={42} distance={1} distanceAccuracy={10} />,
  );
  expect(recordBusinessProfileVisit).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Profile load error")).toBeNull();
});
