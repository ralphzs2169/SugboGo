import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";

import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";

import ExploreBusinessProfileScreen from "../ExploreBusinessProfileScreen";
import useBusinessDetailSource from "../../hooks/useBusinessDetailSource";
import useBusinessProfileVisit from "../../hooks/useBusinessProfileVisit";
import useRoutePlanningIntent from "../../hooks/useRoutePlanningIntent";
import { useBusinessReviewPreview } from "../../hooks/useBusinessReviews";
import { ReviewDerivedDataSyncProvider } from "../../hooks/ReviewDerivedDataSyncProvider";
import { snapshotFixture } from "@/features/offline-pockets/validation/__tests__/snapshotFixture";
const mockRecordRouteIntent = jest.fn();
jest.mock("../../hooks/useRoutePlanningIntent", () => ({
  __esModule: true,
  default: jest.fn(() => mockRecordRouteIntent),
}));

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
  },
}));
jest.mock("../../hooks/useBusinessDetailSource", () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock("../../components/business-profile/ReadOnlyBusinessProfile", () => {
  const { Text } = jest.requireActual("react-native");
  return function MockReadOnlyProfile({
    snapshot,
  }: {
    snapshot: { business: { business_name: string } };
  }) {
    return <Text>{snapshot.business.business_name}</Text>;
  };
});
jest.mock("../../hooks/ReviewDerivedDataSyncProvider", () => ({
  ReviewDerivedDataSyncProvider: jest.fn(
    ({ children }: { children: React.ReactNode }) => children,
  ),
}));
jest.mock("../../hooks/useBusinessProfileVisit", () => jest.fn());
jest.mock("@/shared/utils/presentBottomSheet.utils", () => ({
  presentBottomSheet: jest.fn(),
}));
jest.mock("../../hooks/useBusinessReviews", () => ({
  useBusinessReviewPreview: jest.fn(() => ({
    totalCount: 0,
  })),
}));
jest.mock("../../utils/businessHours.utils", () => ({
  getBusinessHoursSummary: () => ({
    status: "open",
  }),
  getQuickInfoStatus: () => ({
    statusLabel: "Open",
    statusDetail: "Until 8 PM",
    isOpen: true,
  }),
}));
jest.mock(
  "../../components/business-profile/BusinessProfileScrollView",
  () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { View } = require("react-native");

      return <View>{children}</View>;
    },
  }),
);
jest.mock("../../components/business-profile/BusinessProfileSection", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { View } = require("react-native");

    return <View>{children}</View>;
  },
}));
jest.mock(
  "../../components/business-profile/reviews/review-preview-section/BusinessReviewsPreviewSection",
  () => ({
    __esModule: true,
    default: ({
      isOwnBusiness,
      hasOwnReview,
      onWriteReview,
    }: {
      isOwnBusiness: boolean;
      hasOwnReview: boolean;
      onWriteReview: () => void;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Pressable, View } = require("react-native");

      return (
        <View testID="profile-reviews">
          {!isOwnBusiness && !hasOwnReview ? (
            <Pressable testID="write-review-action" onPress={onWriteReview} />
          ) : null}
        </View>
      );
    },
  }),
);
jest.mock("../../components/business-profile/SimilarPlacesSection", () => ({
  __esModule: true,
  default: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { View } = require("react-native");

    return <View testID="profile-similar-places" />;
  },
}));

jest.mock("../../components/business-profile/ExploreBusinessHero", () => ({
  __esModule: true,
  default: ({ isOwnBusiness }: { isOwnBusiness: boolean }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text } = require("react-native");

    return <Text>{isOwnBusiness ? "Your Business" : "Explorer hero"}</Text>;
  },
}));
jest.mock("../../components/business-profile/BusinessProfileQuickInfo", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock(
  "../../components/business-profile/BusinessSpecialtiesSection",
  () => ({
    __esModule: true,
    default: () => null,
  }),
);
jest.mock("../../components/business-profile/BusinessAboutContent", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("../../components/business-profile/BusinessPhotosSection", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("../../components/business-profile/BusinessVisitInfoContent", () => ({
  __esModule: true,
  default: ({
    isOwnBusiness,
    onViewRoute,
    onJeepneyGuide,
    onRide,
  }: {
    isOwnBusiness: boolean;
    onViewRoute: () => void;
    onJeepneyGuide: () => void;
    onRide: () => void;
  }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pressable, View } = require("react-native");

    if (isOwnBusiness) {
      return null;
    }

    return (
      <View>
        <Pressable testID="route-action" onPress={onViewRoute} />
        <Pressable testID="jeepney-action" onPress={onJeepneyGuide} />
        <Pressable testID="ride-action" onPress={onRide} />
      </View>
    );
  },
}));
jest.mock("../../components/business-profile/BusinessProfileFooter", () => ({
  __esModule: true,
  default: ({ isOwnBusiness }: { isOwnBusiness: boolean }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text } = require("react-native");

    return isOwnBusiness ? <Text>Manage My Business</Text> : null;
  },
}));
jest.mock("../../components/business-profile/RideProviderSheet", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("../../components/business-profile/ReviewComposerSheet", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/shared/components/modals/FullScreenPhotoViewer", () => ({
  __esModule: true,
  default: () => null,
}));

const explorerBusiness = {
  id: 20,
  business_name: "Current Business",
  is_own_business: false,
  has_own_review: false,
  specialty_tags: [],
  description: null,
  location: {
    address: "Cebu",
    city: "Cebu City",
    province: "Cebu",
    latitude: 10.31,
    longitude: 123.89,
  },
  operating_hours: [],
  contact_number: "09171234567",
  email: null,
  website: null,
  photos: [],
};

describe("Explore Business Profile actions and section placement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useBusinessDetailSource as jest.Mock).mockReturnValue({
      source: "live",
      business: explorerBusiness,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  it("renders Similar Places after Reviews", async () => {
    const screen = await render(
      <ExploreBusinessProfileScreen
        businessId={20}
        distance={null}
        distanceAccuracy={null}
      />,
    );
    const tree = JSON.stringify(screen.toJSON());

    expect(tree.indexOf("profile-reviews")).toBeGreaterThan(-1);
    expect(tree.indexOf("profile-similar-places")).toBeGreaterThan(
      tree.indexOf("profile-reviews"),
    );
  });

  it("opens Road Route and Jeepney Guide directly", async () => {
    const screen = await render(
      <ExploreBusinessProfileScreen
        businessId={20}
        distance={null}
        distanceAccuracy={null}
      />,
    );

    await fireEvent.press(screen.getByTestId("route-action"));
    expect(mockRecordRouteIntent).toHaveBeenLastCalledWith("ROAD_ROUTE");

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(explorer)/business/[businessId]/road-route",
      params: {
        businessId: "20",
      },
    });

    await fireEvent.press(screen.getByTestId("jeepney-action"));
    expect(mockRecordRouteIntent).toHaveBeenLastCalledWith("JEEPNEY");

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(explorer)/business/[businessId]/jeepney-guide",
      params: {
        businessId: "20",
      },
    });
  });

  it("opens ride selection and the inline review composer without a footer", async () => {
    const screen = await render(
      <ExploreBusinessProfileScreen
        businessId={20}
        distance={null}
        distanceAccuracy={null}
      />,
    );

    await fireEvent.press(screen.getByTestId("ride-action"));
    await fireEvent.press(screen.getByTestId("write-review-action"));

    expect(presentBottomSheet).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Manage My Business")).toBeNull();
    expect(mockRecordRouteIntent).not.toHaveBeenCalled();
  });

  it("preserves the owner footer and hides Explorer actions", async () => {
    (useBusinessDetailSource as jest.Mock).mockReturnValue({
      source: "live",
      business: {
        ...explorerBusiness,
        is_own_business: true,
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const screen = await render(
      <ExploreBusinessProfileScreen
        businessId={20}
        distance={null}
        distanceAccuracy={null}
      />,
    );

    expect(screen.getByText("Manage My Business")).toBeTruthy();
    expect(screen.queryByTestId("route-action")).toBeNull();
    expect(screen.queryByTestId("write-review-action")).toBeNull();
  });

  it("shows Explorer presentation in merchant preview without enabling review creation", async () => {
    (useBusinessDetailSource as jest.Mock).mockReturnValue({
      source: "live",
      business: {
        ...explorerBusiness,
        is_own_business: true,
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const screen = await render(
      <ExploreBusinessProfileScreen
        businessId={20}
        distance={null}
        distanceAccuracy={null}
        previewAsExplorer
      />,
    );

    expect(screen.getByText("Explorer hero")).toBeTruthy();
    expect(screen.queryByText("Your Business")).toBeNull();
    expect(screen.queryByText("Manage My Business")).toBeNull();
    expect(screen.getByTestId("route-action")).toBeTruthy();
    expect(screen.queryByTestId("write-review-action")).toBeNull();
  });

  it("does not offer duplicate review creation", async () => {
    (useBusinessDetailSource as jest.Mock).mockReturnValue({
      source: "live",
      business: {
        ...explorerBusiness,
        has_own_review: true,
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const screen = await render(
      <ExploreBusinessProfileScreen
        businessId={20}
        distance={null}
        distanceAccuracy={null}
      />,
    );

    expect(screen.queryByTestId("write-review-action")).toBeNull();
  });
});

it.each(["recent", "offline-pocket"])(
  "never mounts live effects for %s presentation",
  async (source) => {
    jest.clearAllMocks();
    jest.mocked(useBusinessDetailSource).mockReturnValue({
      source,
      business: null,
      snapshot: snapshotFixture(),
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: jest.fn(),
    } as never);
    const screen = await render(
      <ExploreBusinessProfileScreen
        businessId={21}
        distance={null}
        distanceAccuracy={null}
      />,
    );
    expect(screen.getByText("Sugbo Cafe")).toBeTruthy();
    expect(useBusinessProfileVisit).not.toHaveBeenCalled();
    expect(useBusinessReviewPreview).not.toHaveBeenCalled();
    expect(useRoutePlanningIntent).not.toHaveBeenCalled();
    expect(ReviewDerivedDataSyncProvider).not.toHaveBeenCalled();
    expect(screen.queryByTestId("profile-reviews")).toBeNull();
    expect(screen.queryByTestId("profile-similar-places")).toBeNull();
    expect(screen.queryByTestId("route-action")).toBeNull();
    expect(screen.queryByTestId("write-review-action")).toBeNull();
  },
);
