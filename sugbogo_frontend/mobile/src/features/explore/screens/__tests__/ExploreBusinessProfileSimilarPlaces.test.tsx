import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";

import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";

import ExploreBusinessProfileScreen from "../ExploreBusinessProfileScreen";
import useExploreBusinessProfile from "../../hooks/useExploreBusinessProfile";

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
  },
}));
jest.mock("../../hooks/useExploreBusinessProfile");
jest.mock("../../hooks/useBusinessProfileVisit", () => jest.fn());
jest.mock("@/shared/utils/presentBottomSheet.utils", () => ({
  presentBottomSheet: jest.fn(),
}));
jest.mock("../../hooks/useBusinessReviews", () => ({
  useBusinessReviewPreview: () => ({
    totalCount: 0,
  }),
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
  default: () => null,
}));
jest.mock(
  "../../components/business-profile/BusinessProfileQuickInfo",
  () => ({
    __esModule: true,
    default: () => null,
  }),
);
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
jest.mock(
  "../../components/business-profile/BusinessVisitInfoContent",
  () => ({
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
  }),
);
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
    (useExploreBusinessProfile as jest.Mock).mockReturnValue({
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

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(explorer)/business/[businessId]/road-route",
      params: {
        businessId: "20",
      },
    });

    await fireEvent.press(screen.getByTestId("jeepney-action"));

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
  });

  it("preserves the owner footer and hides Explorer actions", async () => {
    (useExploreBusinessProfile as jest.Mock).mockReturnValue({
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

  it("does not offer duplicate review creation", async () => {
    (useExploreBusinessProfile as jest.Mock).mockReturnValue({
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
