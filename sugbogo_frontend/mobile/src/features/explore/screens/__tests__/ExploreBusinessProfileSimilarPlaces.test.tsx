import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { onlineManager } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Share } from "react-native";
import { businessRatingFixture } from "../../__tests__/review.fixtures";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { beginAuthSession } from "@/shared/api/authSessionGeneration.service";
import {
  businessFixture,
  snapshotFixture,
} from "@/features/offline-pockets/validation/__tests__/snapshotFixture";
import PocketPickerProvider from "@/features/pockets/providers/PocketPickerProvider";
import PocketPickerSheet from "@/features/pockets/components/PocketPickerSheet";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";
import ExploreBusinessProfileScreen from "../ExploreBusinessProfileScreen";
import useBusinessDetailSource from "../../hooks/useBusinessDetailSource";
import useBusinessProfilePreview from "../../hooks/useBusinessProfilePreview";
import useBusinessProfileVisit from "../../hooks/useBusinessProfileVisit";
import useRoutePlanningIntent from "../../hooks/useRoutePlanningIntent";
import useBusinessVouch from "../../hooks/useBusinessVouch";
import { useBusinessReviewPreview } from "../../hooks/useBusinessReviews";
import { ReviewDerivedDataSyncProvider } from "../../hooks/ReviewDerivedDataSyncProvider";
import BusinessReviewsSection from "../../components/business-profile/reviews/review-preview-section/BusinessReviewsPreviewSection";
import SimilarPlacesSection from "../../components/business-profile/SimilarPlacesSection";
import ReviewComposerSheet from "../../components/business-profile/ReviewComposerSheet";
import RideProviderSheet from "../../components/business-profile/RideProviderSheet";
import FullscreenPhotoViewer from "@/shared/components/modals/FullScreenPhotoViewer";

// Native screen initialization can exceed Jest's default timeout on Windows.
jest.setTimeout(20000);
jest.mock("@/shared/components/ParticleBurst", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));

const mockRecordRouteIntent = jest.fn();
const mockVouch = jest.fn();
jest.mock("../../hooks/useBusinessProfilePreview", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));
jest.mock("../../hooks/useBusinessDetailSource", () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock("../../hooks/useBusinessProfileVisit", () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock("../../hooks/useVisibilityMutations", () => ({
  useRecordBusinessImpressions: () => ({ mutateAsync: jest.fn() }),
}));
jest.mock("../../components/business-profile/BusinessLocationMap", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("../../hooks/useRoutePlanningIntent", () => ({
  __esModule: true,
  default: jest.fn(() => mockRecordRouteIntent),
}));
jest.mock("../../hooks/useBusinessVouch", () => ({
  __esModule: true,
  default: jest.fn(() => ({ vouch: mockVouch, pendingTagId: null })),
}));
jest.mock("../../hooks/useBusinessReviews", () => ({
  useBusinessReviewPreview: jest.fn(() => ({ totalCount: 12 })),
}));
jest.mock("../../hooks/ReviewDerivedDataSyncProvider", () => ({
  ReviewDerivedDataSyncProvider: jest.fn(
    ({ children }: { children: React.ReactNode }) => children,
  ),
}));
jest.mock(
  "../../components/business-profile/reviews/review-preview-section/BusinessReviewsPreviewSection",
  () => {
    const { Pressable, Text, View } = jest.requireActual("react-native");
    return {
      __esModule: true,
      default: jest.fn(
        ({
          isOwnBusiness,
          hasOwnReview,
          onWriteReview,
        }: {
          isOwnBusiness: boolean;
          hasOwnReview: boolean;
          onWriteReview: () => void;
        }) => (
          <View testID="profile-reviews">
            <Text>Live reviews</Text>
            {!isOwnBusiness && !hasOwnReview && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Write live review"
                onPress={onWriteReview}
              />
            )}
          </View>
        ),
      ),
    };
  },
);
jest.mock("../../components/business-profile/SimilarPlacesSection", () => {
  const { View } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: jest.fn(() => <View testID="profile-similar-places" />),
  };
});
jest.mock("../../components/business-profile/ReviewComposerSheet", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));
jest.mock("../../components/business-profile/RideProviderSheet", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));
jest.mock("@/shared/components/modals/FullScreenPhotoViewer", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));
jest.mock("@/features/pockets/components/PocketPickerSheet", () => {
  const { View } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: jest.fn(() => <View testID="profile-pocket-picker" />),
  };
});
jest.mock("@/shared/utils/presentBottomSheet.utils", () => ({
  presentBottomSheet: jest.fn(),
}));
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    jest.requireActual("react").useEffect(effect, [effect]);
  },
  useIsFocused: () => true,
  router: { back: jest.fn(), canGoBack: () => true, push: jest.fn() },
  useNavigation: () => ({
    isFocused: () => true,
    addListener: () => () => undefined,
  }),
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("expo-linear-gradient", () => ({
  LinearGradient: jest.requireActual("react-native").View,
}));
jest.mock("expo-image", () => {
  const { View } = jest.requireActual("react-native");
  const MockImage = ({ source }: { source: { uri: string } }) => (
    <View testID="profile-image" source={source} />
  );
  MockImage.getCachePathAsync = jest.fn(async () => null);
  return { Image: MockImage };
});
jest.mock(
  "../../assets/getting-there-icons/route-map-option.svg",
  () => () => null,
);
jest.mock(
  "../../assets/getting-there-icons/jeep-route-option.svg",
  () => () => null,
);
jest.mock(
  "../../assets/getting-there-icons/book-ride-option.svg",
  () => () => null,
);
jest.mock(
  "@/shared/components/Skeleton",
  () => jest.requireActual("react-native").View,
);

const business = {
  ...businessFixture(),
  description: "A familiar business description. ".repeat(15),
  is_own_business: false,
  has_own_review: false,
};
const refetch = jest.fn();
function source(mode: "live" | "recent" | "offline-pocket" | "unavailable") {
  return {
    source: mode,
    business: mode === "live" ? business : null,
    snapshot:
      mode === "recent" || mode === "offline-pocket"
        ? {
            ...snapshotFixture(),
            business: {
              ...snapshotFixture().business,
              description: business.description,
            },
          }
        : null,
    localCoverUri:
      mode === "offline-pocket" ? "file:///managed-cover.jpg" : undefined,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch,
  };
}
function profile() {
  return (
    <ExploreBusinessProfileScreen
      businessId={21}
      distance={1.2}
      distanceAccuracy={10}
    />
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useBusinessProfilePreview).mockReturnValue(null);
  jest
    .mocked(useBusinessReviewPreview)
    .mockReturnValue({ totalCount: 12 } as never);
  beginAuthSession();
  useAuthStore.setState({
    user: { id: 7 } as never,
    isAuthenticated: true,
    isLoading: false,
  });
  onlineManager.setOnline(true);
  jest.mocked(useBusinessDetailSource).mockReturnValue(source("live") as never);
  jest.mocked(Image.getCachePathAsync).mockResolvedValue(null);
});

it("uses the detail review count until preview resolves, including a confirmed zero", async () => {
  jest
    .mocked(useBusinessReviewPreview)
    .mockReturnValue({ totalCount: null } as never);
  const view = await render(profile());
  expect(view.getByText(`${business.review_count} reviews`)).toBeTruthy();
  expect(view.queryByText("0")).toBeNull();
  jest
    .mocked(useBusinessReviewPreview)
    .mockReturnValue({ totalCount: 0 } as never);
  await view.rerender(profile());
  expect(view.getByText("0 reviews")).toBeTruthy();
});

it("integrates the live rating into hero and sticky identity without a duplicate block or offline rating", async () => {
  jest.mocked(useBusinessDetailSource).mockReturnValue({
    ...source("live"),
    business: { ...business, sentiment_rating: businessRatingFixture() },
  } as never);
  const view = await render(profile());
  expect(view.queryByText("rating")).toBeNull();
  expect(view.getByLabelText("Business rating 3.6 out of 5")).toBeTruthy();
  expect(
    view.queryByText(/AI sentiment|Experimental|scored reviews|\/5/),
  ).toBeNull();
  await fireEvent.scroll(view.getByTestId("business-profile-scroll"), {
    nativeEvent: { contentOffset: { y: 300 } },
  });
  await waitFor(() => {
    expect(
      view.getByLabelText(/Sugbo Cafe.*Business rating 3.6 out of 5/),
    ).toBeTruthy();
  });
  jest
    .mocked(useBusinessDetailSource)
    .mockReturnValue(source("recent") as never);
  await view.rerender(profile());
  expect(view.queryByText("3.6")).toBeNull();
  expect(view.queryByLabelText(/Business rating/)).toBeNull();
});

it("shares from both visible headers and hides sticky controls at the top", async () => {
  const share = jest
    .spyOn(Share, "share")
    .mockResolvedValue({ action: Share.dismissedAction });
  const view = await render(profile());
  expect(
    view.getAllByRole("button", { name: "Share Sugbo Cafe" }),
  ).toHaveLength(1);
  await fireEvent.press(view.getByRole("button", { name: "Share Sugbo Cafe" }));
  expect(share).toHaveBeenCalledTimes(1);
  await fireEvent.scroll(view.getByTestId("business-profile-scroll"), {
    nativeEvent: { contentOffset: { y: 300 } },
  });
  await waitFor(() =>
    expect(
      view.getAllByRole("button", { name: "Share Sugbo Cafe" }),
    ).toHaveLength(2),
  );
  await fireEvent.press(
    view.getAllByRole("button", { name: "Share Sugbo Cafe" })[0],
  );
  expect(share).toHaveBeenCalledTimes(2);
  await fireEvent.scroll(view.getByTestId("business-profile-scroll"), {
    nativeEvent: { contentOffset: { y: 0 } },
  });
  expect(
    view.getAllByRole("button", { name: "Share Sugbo Cafe" }),
  ).toHaveLength(1);
  share.mockRestore();
});

it("dispatches Back only once before the current route loses focus", async () => {
  const view = await render(profile());
  const back = view.getByRole("button", { name: "Go back" });
  await fireEvent.press(back);
  await fireEvent.press(back);
  expect(router.back).toHaveBeenCalledTimes(1);
});
afterEach(() => {
  onlineManager.setOnline(true);
});

it("keeps live review ordering, route actions, ride and review creation", async () => {
  const view = await render(profile());
  expect(
    view
      .getAllByTestId(/^profile-(reviews|similar-places)$/)
      .map((section) => section.props.testID),
  ).toEqual(["profile-reviews", "profile-similar-places"]);
  await fireEvent.press(view.getByLabelText("View road route"));
  expect(mockRecordRouteIntent).toHaveBeenLastCalledWith("ROAD_ROUTE");
  expect(router.push).toHaveBeenCalledWith({
    pathname: "/(explorer)/business/[businessId]/road-route",
    params: { businessId: "21" },
  });
  await fireEvent.press(view.getByLabelText("Open jeepney guide"));
  expect(mockRecordRouteIntent).toHaveBeenLastCalledWith("JEEPNEY");
  await fireEvent.press(view.getByLabelText("Choose a ride provider"));
  await fireEvent.press(view.getByLabelText("Write live review"));
  expect(presentBottomSheet).toHaveBeenCalledTimes(2);
});

it("renders the existing skeleton on initial online loading, then the interactive live profile", async () => {
  jest.mocked(useBusinessDetailSource).mockReturnValue({
    ...source("unavailable"),
    isLoading: true,
    isInitialLoading: true,
    isFetching: true,
  } as never);
  const view = await render(profile());
  expect(view.getByText("Vouch for what this place gets right")).toBeTruthy();
  expect(view.queryByLabelText("Current status unavailable")).toBeNull();
  expect(view.queryByText(/^Previously loaded/)).toBeNull();
  expect(view.queryByText(/^Saved for offline/)).toBeNull();
  expect(view.queryByLabelText("View road route")).toBeNull();
  expect(view.queryAllByLabelText("Pocket unavailable offline")).toHaveLength(
    0,
  );
  expect(useBusinessVouch).not.toHaveBeenCalled();
  expect(BusinessReviewsSection).not.toHaveBeenCalled();
  jest.mocked(useBusinessDetailSource).mockReturnValue(source("live") as never);
  await view.rerender(profile());
  expect(view.queryByText("Vouch for what this place gets right")).toBeNull();
  expect(
    view.getByLabelText("View road route").props.accessibilityState.disabled,
  ).toBe(false);
  expect(view.getByTestId("profile-reviews")).toBeTruthy();
});

const listingPreview = {
  id: 21,
  business_name: "Earlier listing name",
  display_cover_photo_url: "https://example.test/preview-cover.jpg",
  cluster: business.cluster,
  category: business.category,
};

it("shows preview identity with unresolved sections and no live actions, then replaces it with detail", async () => {
  jest.mocked(useBusinessProfilePreview).mockReturnValue(listingPreview);
  jest.mocked(useBusinessDetailSource).mockReturnValue({
    ...source("unavailable"),
    isLoading: true,
    isInitialLoading: true,
  } as never);
  const view = await render(profile());
  expect(view.getByText(listingPreview.business_name)).toBeTruthy();
  expect(
    view.getByText(`${business.cluster.name} · ${business.category.name}`),
  ).toBeTruthy();
  expect(view.getByTestId("profile-image").props.source.uri).toBe(
    listingPreview.display_cover_photo_url,
  );
  expect(view.getByText("Vouch for what this place gets right")).toBeTruthy();
  expect(view.getAllByRole("button")).toHaveLength(1);
  expect(view.getByRole("button", { name: "Go back" })).toBeTruthy();
  expect(useBusinessVouch).not.toHaveBeenCalled();
  expect(useBusinessProfileVisit).not.toHaveBeenCalled();
  expect(ReviewDerivedDataSyncProvider).not.toHaveBeenCalled();
  expect(SimilarPlacesSection).not.toHaveBeenCalled();
  expect(BusinessReviewsSection).not.toHaveBeenCalled();
  expect(useBusinessReviewPreview).not.toHaveBeenCalled();

  jest.mocked(useBusinessDetailSource).mockReturnValue(source("live") as never);
  await view.rerender(profile());
  expect(view.queryByText(listingPreview.business_name)).toBeNull();
  expect(view.getByText(business.business_name)).toBeTruthy();
  expect(view.getByTestId("profile-reviews")).toBeTruthy();
  expect(
    view.getByRole("button", { name: `Share ${business.business_name}` }),
  ).toBeTruthy();
});

it.each(["live", "recent", "offline-pocket"] as const)(
  "keeps %s detail ahead of stale preview identity",
  async (mode) => {
    jest.mocked(useBusinessProfilePreview).mockReturnValue(listingPreview);
    jest.mocked(useBusinessDetailSource).mockReturnValue(source(mode) as never);
    const view = await render(profile());
    expect(view.queryByText(listingPreview.business_name)).toBeNull();
    expect(view.getByText(business.business_name)).toBeTruthy();
  },
);

it.each(["NOT_FOUND", "PERMISSION_DENIED", "NOT_AUTHENTICATED"])(
  "removes preview after definitive %s response",
  async (code) => {
    jest.mocked(useBusinessProfilePreview).mockReturnValue(listingPreview);
    jest.mocked(useBusinessDetailSource).mockReturnValue({
      ...source("unavailable"),
      isLoading: true,
      isInitialLoading: true,
    } as never);
    const view = await render(profile());
    expect(view.getByText(listingPreview.business_name)).toBeTruthy();
    jest.mocked(useBusinessDetailSource).mockReturnValue({
      ...source("unavailable"),
      error: { code },
      denied: true,
    } as never);
    await view.rerender(profile());
    expect(view.queryByText(listingPreview.business_name)).toBeNull();
    expect(view.getByTestId("business-profile-error")).toBeTruthy();
    expect(ReviewDerivedDataSyncProvider).not.toHaveBeenCalled();
  },
);

it("never renders another business preview or a preview while offline sources resolve", async () => {
  jest
    .mocked(useBusinessProfilePreview)
    .mockReturnValue({ ...listingPreview, id: 22 });
  jest.mocked(useBusinessDetailSource).mockReturnValue({
    ...source("unavailable"),
    isLoading: true,
    isInitialLoading: true,
  } as never);
  const view = await render(profile());
  expect(view.queryByText(listingPreview.business_name)).toBeNull();
  jest.mocked(useBusinessProfilePreview).mockReturnValue(listingPreview);
  jest.mocked(useBusinessDetailSource).mockReturnValue({
    ...source("unavailable"),
    isLoading: true,
    isInitialLoading: false,
  } as never);
  await view.rerender(profile());
  expect(view.queryByText(listingPreview.business_name)).toBeNull();
  expect(view.getByText("Vouch for what this place gets right")).toBeTruthy();
});

it.each(["recent", "offline-pocket"] as const)(
  "keeps %s visible and disabled while recovery is pending or fails",
  async (mode) => {
    jest.mocked(useBusinessDetailSource).mockReturnValue(source(mode) as never);
    await act(async () => onlineManager.setOnline(false));
    const view = await render(profile());
    const scroll = view.getByTestId("business-profile-scroll");
    await act(async () => onlineManager.setOnline(true));
    for (const error of [null, { code: "NETWORK_ERROR" }]) {
      jest.mocked(useBusinessDetailSource).mockReturnValue({
        ...source(mode),
        isFetching: error === null,
        isInitialLoading: false,
        error,
      } as never);
      await view.rerender(profile());
      expect(view.getByTestId("business-profile-scroll")).toBe(scroll);
      expect(
        view.queryByText("Vouch for what this place gets right"),
      ).toBeNull();
      expect(view.getByLabelText("Current status unavailable")).toBeTruthy();
      expect(
        view.getByLabelText("View road route").props.accessibilityState
          .disabled,
      ).toBe(true);
      expect(BusinessReviewsSection).not.toHaveBeenCalled();
    }
    jest
      .mocked(useBusinessDetailSource)
      .mockReturnValue(source("live") as never);
    await view.rerender(profile());
    expect(view.getByTestId("business-profile-scroll")).toBe(scroll);
    expect(view.getByTestId("profile-reviews")).toBeTruthy();
  },
);

it("shows loading while offline sources resolve, then a viewport-filling error without degraded controls", async () => {
  jest.mocked(useBusinessDetailSource).mockReturnValue({
    ...source("unavailable"),
    isLoading: true,
    isInitialLoading: false,
  } as never);
  await act(async () => onlineManager.setOnline(false));
  const view = await render(profile());
  expect(view.getByText("Vouch for what this place gets right")).toBeTruthy();
  expect(view.queryByLabelText("Current status unavailable")).toBeNull();
  expect(view.queryByLabelText("View road route")).toBeNull();
  expect(view.queryByText("Unable to load business")).toBeNull();
  jest
    .mocked(useBusinessDetailSource)
    .mockReturnValue(source("unavailable") as never);
  await view.rerender(profile());
  expect(view.queryByText("Vouch for what this place gets right")).toBeNull();
  expect(view.queryByLabelText("Current status unavailable")).toBeNull();
  expect(view.getByTestId("business-profile-error").props.className).toContain(
    "flex-1",
  );
  expect(
    view.getByTestId("business-profile-error-hero").props.className,
  ).toContain("h-[21.5rem]");
  expect(
    view.getByTestId("business-profile-error-body").props.className,
  ).toContain("flex-1");
  expect(
    view.getByTestId("business-profile-scroll").props.contentContainerStyle
      .flexGrow,
  ).toBe(1);
  await fireEvent.press(view.getByRole("button", { name: "Retry" }));
  expect(refetch).toHaveBeenCalled();
});

it("previews loading, local, recovery and unavailable states without mounting live behavior", async () => {
  jest
    .mocked(useBusinessDetailSource)
    .mockReturnValue(source("unavailable") as never);
  const view = await render(profile());
  await fireEvent.press(
    view.getByLabelText("Toggle business profile state preview"),
  );
  for (const label of ["Online loading", "Local loading"]) {
    await fireEvent.press(view.getByLabelText(`Preview ${label}`));
    expect(view.getByText("Vouch for what this place gets right")).toBeTruthy();
    expect(view.queryByLabelText("Current status unavailable")).toBeNull();
  }
  for (const label of [
    "Pocket",
    "Recent",
    "Recovering",
    "Recovery failed",
    "Long name",
    "Missing info",
  ]) {
    await fireEvent.press(view.getByLabelText(`Preview ${label}`));
    expect(view.getByLabelText("Current status unavailable")).toBeTruthy();
    expect(
      view.getByLabelText("View road route").props.accessibilityState.disabled,
    ).toBe(true);
    expect(view.queryByTestId("profile-reviews")).toBeNull();
  }
  for (const label of ["Unavailable", "Denied"]) {
    await fireEvent.press(view.getByLabelText(`Preview ${label}`));
    expect(view.getByTestId("business-profile-error-hero")).toBeTruthy();
    expect(view.getByText("Unable to load business")).toBeTruthy();
    expect(view.queryByLabelText("Current status unavailable")).toBeNull();
  }
  await fireEvent.press(view.getByLabelText("Preview Live"));
  expect(view.getByText(/^Live is unavailable/)).toBeTruthy();
  expect(useBusinessVouch).not.toHaveBeenCalled();
  expect(BusinessReviewsSection).not.toHaveBeenCalled();
  expect(mockRecordRouteIntent).not.toHaveBeenCalled();
  expect(refetch).not.toHaveBeenCalled();
  await fireEvent.press(view.getByLabelText("Preview Actual"));
  expect(view.getByText("Unable to load business")).toBeTruthy();
});

it("does not expose the development preview toggle in release", async () => {
  const development = __DEV__;
  Object.defineProperty(globalThis, "__DEV__", { value: false });
  try {
    const view = await render(profile());
    expect(
      view.queryByLabelText("Toggle business profile state preview"),
    ).toBeNull();
  } finally {
    Object.defineProperty(globalThis, "__DEV__", { value: development });
  }
});

it("preserves owner and preview capabilities", async () => {
  jest.mocked(useBusinessDetailSource).mockReturnValue({
    ...source("live"),
    business: { ...business, is_own_business: true },
  } as never);
  const view = await render(profile());
  expect(view.getByText("Manage My Business")).toBeTruthy();
  expect(view.queryByLabelText("View road route")).toBeNull();
  expect(view.queryByLabelText("Write live review")).toBeNull();
  await view.rerender(
    <ExploreBusinessProfileScreen
      businessId={21}
      distance={null}
      distanceAccuracy={null}
      previewAsExplorer
    />,
  );
  expect(view.queryByText("Manage My Business")).toBeNull();
  expect(view.getByLabelText("View road route")).toBeTruthy();
  expect(view.queryByLabelText("Write live review")).toBeNull();
});

it.each(["recent", "offline-pocket"] as const)(
  "degrades live to %s in the same scroll shell with disabled actions and no live behavior",
  async (mode) => {
    const view = await render(profile());
    const scroll = view.getByTestId("business-profile-scroll");
    await fireEvent.press(view.getByText("Read more"));
    await fireEvent.press(view.getByLabelText("Show full business hours"));
    jest.clearAllMocks();
    jest.mocked(useBusinessDetailSource).mockReturnValue(source(mode) as never);
    await act(async () => onlineManager.setOnline(false));
    await view.rerender(profile());
    await waitFor(() =>
      expect(view.getAllByText("Sugbo Cafe").length).toBeGreaterThan(0),
    );
    expect(view.getByTestId("business-profile-scroll")).toBe(scroll);
    expect(view.getByText("Show less")).toBeTruthy();
    expect(view.getByLabelText("Hide full business hours")).toBeTruthy();
    expect(view.getByText("Plan Your Visit")).toBeTruthy();
    expect(view.getByLabelText("Current status unavailable")).toBeTruthy();
    expect(view.queryByLabelText("Reviews unavailable")).toBeNull();
    expect(view.queryByLabelText("Distance unavailable")).toBeNull();
    expect(view.queryByText("12")).toBeNull();
    const route = view.getByLabelText("View road route");
    expect(route.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(route);
    await fireEvent.press(view.getByLabelText("Open jeepney guide"));
    await fireEvent.press(view.getByLabelText("Choose a ride provider"));
    expect(view.queryByRole("button", { name: "Write a review" })).toBeNull();
    expect(view.getByText("Reviews need a connection")).toBeTruthy();
    const vouch = view.getAllByRole("button", {
      name: /Vouch unavailable offline/,
    })[0];
    expect(vouch.props.accessibilityState).toMatchObject({ disabled: true });
    expect(vouch.props.accessibilityState.selected).toBeUndefined();
    await fireEvent.press(vouch);
    expect(
      view.getAllByRole("button", { name: "Pocket unavailable offline" }),
    ).toHaveLength(1);
    for (const hook of [
      useBusinessProfileVisit,
      useBusinessReviewPreview,
      useRoutePlanningIntent,
      useBusinessVouch,
      ReviewDerivedDataSyncProvider,
      BusinessReviewsSection,
      SimilarPlacesSection,
      ReviewComposerSheet,
      RideProviderSheet,
    ]) {
      expect(hook).not.toHaveBeenCalled();
    }
    expect(router.push).not.toHaveBeenCalled();
    expect(mockVouch).not.toHaveBeenCalled();
    expect(presentBottomSheet).not.toHaveBeenCalled();
    for (const image of view.queryAllByTestId("profile-image")) {
      expect(image.props.source.uri).toMatch(/^file:\/\//);
    }
    if (mode === "offline-pocket") {
      expect(view.getByText(/^Saved for offline/)).toBeTruthy();
    } else {
      expect(view.getByText("Previously loaded")).toBeTruthy();
    }
  },
);

it("keeps shell state through brief local resolution and revokes denied presentation", async () => {
  const view = await render(profile());
  const scroll = view.getByTestId("business-profile-scroll");
  await fireEvent.press(view.getByText("Read more"));
  jest
    .mocked(useBusinessDetailSource)
    .mockReturnValue({ ...source("unavailable"), isLoading: true } as never);
  await view.rerender(profile());
  expect(view.getByTestId("business-profile-scroll")).toBe(scroll);
  jest
    .mocked(useBusinessDetailSource)
    .mockReturnValue(source("recent") as never);
  await view.rerender(profile());
  expect(view.getByText("Show less")).toBeTruthy();
  jest.mocked(useBusinessDetailSource).mockReturnValue({
    ...source("unavailable"),
    error: { code: "PERMISSION_DENIED" },
    denied: true,
  } as never);
  await view.rerender(profile());
  expect(view.queryByText("Show less")).toBeNull();
  expect(view.queryByText("Sugbo Cafe")).toBeNull();
});

it("uses existing local photo files and omits uncached photos without downloading", async () => {
  jest
    .mocked(useBusinessDetailSource)
    .mockReturnValue(source("recent") as never);
  jest
    .mocked(Image.getCachePathAsync)
    .mockImplementation(async (url) =>
      url.includes("cover") ? "/data/cover.jpg" : null,
    );
  const view = await render(profile());
  await waitFor(() =>
    expect(view.getAllByTestId("profile-image").length).toBeGreaterThan(0),
  );
  for (const image of view.getAllByTestId("profile-image")) {
    expect(image.props.source.uri).toBe("file:///data/cover.jpg");
  }
  expect(FullscreenPhotoViewer).not.toHaveBeenCalled();
});

it("revokes an open Pocket workflow when live authority is lost", async () => {
  const view = await render(
    <PocketPickerProvider>{profile()}</PocketPickerProvider>,
  );
  await fireEvent.press(
    view.getAllByRole("button", {
      name: /Save business to Pockets|Edit Pocket collections/,
    })[0],
  );
  expect(view.getByTestId("profile-pocket-picker")).toBeTruthy();
  const previous = jest.mocked(PocketPickerSheet).mock.calls.at(-1)![0];
  expect(previous.isCurrent?.()).toBe(true);
  jest
    .mocked(useBusinessDetailSource)
    .mockReturnValue(source("recent") as never);
  await view.rerender(<PocketPickerProvider>{profile()}</PocketPickerProvider>);
  expect(view.queryByTestId("profile-pocket-picker")).toBeNull();
  expect(previous.isCurrent?.()).toBe(false);
  expect(
    view.getAllByRole("button", { name: "Pocket unavailable offline" }),
  ).toHaveLength(1);
});
