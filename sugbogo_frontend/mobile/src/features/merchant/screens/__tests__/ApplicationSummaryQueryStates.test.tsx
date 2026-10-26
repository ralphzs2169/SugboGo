import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";

import ErrorState from "@/shared/components/ErrorState";
import LoadingScreen from "@/shared/components/LoadingScreen";
import ReviewBusinessIdentity from "../../components/registration/review/sections/ReviewBusinessIdentity";
import ApplicationSummaryScreen from "../ApplicationSummaryScreen";

const mockRefetchApplication = jest.fn();
const mockRefetchClusters = jest.fn();
const mockRefetchCategories = jest.fn();
const mockRefetchSpecialtyTags = jest.fn();

const application = {
  id: 1,
  identity: { business_cluster_name: "Food", business_category_name: "Cafe" },
};

let mockCurrentState = {
  application: application as typeof application | null,
  isLoading: false,
  error: false,
  refetch: mockRefetchApplication,
};

let mockClustersState = {
  clusters: [{ id: 1, name: "Food", icon: "food" }],
  isLoading: false,
  hasData: true,
  error: null as Error | null,
  refetch: mockRefetchClusters,
};

let mockCategoriesState = {
  categories: [{ id: 2, cluster_id: 1, name: "Cafe" }],
  isLoading: false,
  hasData: true,
  error: null as Error | null,
  refetch: mockRefetchCategories,
};

let mockSpecialtyTagsState = {
  specialtyTags: [] as { id: number; name: string }[],
  isLoading: false,
  hasData: true,
  error: null as Error | null,
  refetch: mockRefetchSpecialtyTags,
};

jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));
jest.mock(
  "@/features/merchant/hooks/registration/useCurrentApplication",
  () => ({
    __esModule: true,
    default: () => mockCurrentState,
  }),
);
jest.mock("../../hooks/registration/useClusters", () => ({
  __esModule: true,
  default: () => mockClustersState,
}));
jest.mock("../../hooks/registration/useCategories", () => ({
  __esModule: true,
  default: () => mockCategoriesState,
}));
jest.mock("../../hooks/registration/useSpecialtyTags", () => ({
  __esModule: true,
  default: () => mockSpecialtyTagsState,
}));
jest.mock(
  "../../utils/merchant-application/mappers/mapApplicationToForm.utils",
  () => ({
    mapApplicationToForm: jest.fn(() => ({
      businessName: "Cebu Cafe",
      businessCluster: "1",
      businessCategory: "2",
      specialtyTags: [3],
      representativeRole: "owner",
    })),
  }),
);
jest.mock("@/shared/components/ErrorState", () => ({
  __esModule: true,
  default: jest.fn(
    jest.requireActual("@/shared/components/ErrorState").default,
  ),
}));
jest.mock("@/shared/components/LoadingScreen", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));
jest.mock(
  "../../components/registration/review/sections/ReviewBusinessIdentity",
  () => ({
    __esModule: true,
    default: jest.fn(
      jest.requireActual(
        "../../components/registration/review/sections/ReviewBusinessIdentity",
      ).default,
    ),
  }),
);
jest.mock(
  "../../components/registration/review/sections/ReviewBusinessLocation",
  () => {
    const { Text } = jest.requireActual("react-native");
    return function LocationSection() {
      return <Text>Saved location</Text>;
    };
  },
);
jest.mock(
  "../../components/registration/review/sections/ReviewBusinessPhotos",
  () => {
    const { Text } = jest.requireActual("react-native");
    return function PhotosSection() {
      return <Text>Saved photos</Text>;
    };
  },
);
jest.mock(
  "../../components/registration/review/sections/ReviewOperatingHours",
  () => {
    const { Text } = jest.requireActual("react-native");
    return function HoursSection() {
      return <Text>Saved hours</Text>;
    };
  },
);
jest.mock(
  "../../components/registration/review/sections/ReviewVerificationDocuments",
  () => {
    const { Text } = jest.requireActual("react-native");
    return function DocumentsSection() {
      return <Text>Saved documents</Text>;
    };
  },
);

describe("ApplicationSummaryScreen query states", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentState = {
      application,
      isLoading: false,
      error: false,
      refetch: mockRefetchApplication,
    };
    mockClustersState = {
      clusters: [{ id: 1, name: "Food", icon: "food" }],
      isLoading: false,
      hasData: true,
      error: null,
      refetch: mockRefetchClusters,
    };
    mockCategoriesState = {
      categories: [{ id: 2, cluster_id: 1, name: "Cafe" }],
      isLoading: false,
      hasData: true,
      error: null,
      refetch: mockRefetchCategories,
    };
    mockSpecialtyTagsState = {
      specialtyTags: [],
      isLoading: false,
      hasData: true,
      error: null,
      refetch: mockRefetchSpecialtyTags,
    };
  });

  it("keeps unrelated sections visible while specialty tags initially load", async () => {
    mockSpecialtyTagsState.isLoading = true;
    mockSpecialtyTagsState.hasData = false;

    const screen = await render(<ApplicationSummaryScreen />);

    expect(LoadingScreen).not.toHaveBeenCalled();
    expect(screen.getByText("Loading specialty tags...")).toBeTruthy();
    expect(screen.getByText("Saved hours")).toBeTruthy();
  });

  it("localizes specialty failure and Retry without hiding saved application sections", async () => {
    mockSpecialtyTagsState.hasData = false;
    mockSpecialtyTagsState.error = new Error("Unavailable");

    const screen = await render(<ApplicationSummaryScreen />);
    expect(screen.getByText("Unable to load specialty tags.")).toBeTruthy();
    for (const section of ["location", "hours", "photos", "documents"]) {
      expect(screen.getByText(`Saved ${section}`)).toBeTruthy();
    }
    expect(screen.getByText("Cebu Cafe")).toBeTruthy();
    await fireEvent.press(screen.getByText("Retry"));
    expect(mockRefetchSpecialtyTags).toHaveBeenCalledTimes(1);
    mockSpecialtyTagsState = {
      ...mockSpecialtyTagsState,
      hasData: true,
      error: null,
      specialtyTags: [{ id: 3, name: "Coffee" }],
    };
    await screen.rerender(<ApplicationSummaryScreen />);
    expect(screen.getByText("Coffee")).toBeTruthy();
    expect(screen.queryByText("Unable to load specialty tags.")).toBeNull();
    expect(screen.getByText("Saved documents")).toBeTruthy();
    expect(mockRefetchApplication).not.toHaveBeenCalled();
  });

  it("shows a recoverable absence instead of a blank body", async () => {
    mockCurrentState.application = null;
    const screen = await render(<ApplicationSummaryScreen />);
    expect(screen.getByText("No submitted application")).toBeTruthy();
    expect(
      screen.getByText("There is no submitted application to display."),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText("Go Back"));
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Try Again")).toBeNull();
  });

  it("uses server classification names when supporting lookups fail", async () => {
    mockClustersState.clusters = [];
    mockClustersState.hasData = false;
    mockClustersState.error = new Error("Unavailable");
    mockCategoriesState.categories = [];
    mockCategoriesState.hasData = false;
    mockCategoriesState.error = new Error("Unavailable");
    const screen = await render(<ApplicationSummaryScreen />);
    expect(screen.getByText("Food")).toBeTruthy();
    expect(screen.getByText("Cafe")).toBeTruthy();
    expect(screen.getByText("Saved location")).toBeTruthy();
    expect(
      screen.getByText("Business classifications could not be refreshed."),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText("Retry"));
    expect(mockRefetchClusters).toHaveBeenCalledTimes(1);
    expect(mockRefetchCategories).toHaveBeenCalledTimes(1);
  });

  it("keeps cached application and options visible after refetch failure", async () => {
    mockCurrentState.error = true;
    mockClustersState.error = new Error("Unavailable");

    await render(<ApplicationSummaryScreen />);

    expect(ReviewBusinessIdentity).toHaveBeenCalled();
    expect(ErrorState).toHaveBeenCalledWith(
      expect.objectContaining({
        size: "section",
        title: "Unable to refresh application",
      }),
      undefined,
    );
  });

  it("keeps the blocking error for an initial application failure", async () => {
    mockCurrentState.application = null;
    mockCurrentState.error = true;

    await render(<ApplicationSummaryScreen />);

    expect(ErrorState).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Unable to load application" }),
      undefined,
    );
    expect(ReviewBusinessIdentity).not.toHaveBeenCalled();
  });
});
