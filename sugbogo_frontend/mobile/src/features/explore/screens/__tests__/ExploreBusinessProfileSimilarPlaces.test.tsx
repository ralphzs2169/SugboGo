import { render } from "@testing-library/react-native";

import ExploreBusinessProfileScreen from "../ExploreBusinessProfileScreen";
import useExploreBusinessProfile from "../../hooks/useExploreBusinessProfile";

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
  },
}));
jest.mock("../../hooks/useExploreBusinessProfile");
jest.mock("../../hooks/useBusinessProfileVisit", () => jest.fn());
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
  "../../components/business-profile/review-section/BusinessReviewsSection",
  () => ({
    __esModule: true,
    default: () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { View } = require("react-native");

      return <View testID="profile-reviews" />;
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
    default: () => null,
  }),
);
jest.mock("../../components/business-profile/BusinessProfileFooter", () => ({
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

describe("Explore Business Profile Similar Places placement", () => {
  it("renders Similar Places after Reviews", async () => {
    (useExploreBusinessProfile as jest.Mock).mockReturnValue({
      business: {
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
    const tree = JSON.stringify(screen.toJSON());

    expect(tree.indexOf("profile-reviews")).toBeGreaterThan(-1);
    expect(tree.indexOf("profile-similar-places")).toBeGreaterThan(
      tree.indexOf("profile-reviews"),
    );
  });
});
