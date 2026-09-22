import { render } from "@testing-library/react-native";

import ErrorState from "@/shared/components/ErrorState";
import LoadingScreen from "@/shared/components/LoadingScreen";
import ReviewBusinessIdentity from "../../components/registration/review/sections/ReviewBusinessIdentity";
import ApplicationSummaryScreen from "../ApplicationSummaryScreen";

const mockRefetchApplication = jest.fn();
const mockRefetchClusters = jest.fn();
const mockRefetchCategories = jest.fn();
const mockRefetchSpecialtyTags = jest.fn();

let mockCurrentState = {
  application: { id: 1 } as { id: number } | null,
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
  isLoading: false,
  hasData: true,
  error: null as Error | null,
  refetch: mockRefetchSpecialtyTags,
};

jest.mock("expo-router", () => ({ router: { back: jest.fn() } }));
jest.mock("@/features/merchant/hooks/registration/useCurrentApplication", () => ({
  __esModule: true,
  default: () => mockCurrentState,
}));
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
jest.mock("../../utils/merchant-application/mappers/mapApplicationToForm.utils", () => ({
  mapApplicationToForm: jest.fn(() => ({})),
}));
jest.mock("@/shared/components/ErrorState", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));
jest.mock("@/shared/components/LoadingScreen", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));
jest.mock("../../components/registration/review/sections/ReviewBusinessIdentity", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));
jest.mock("../../components/registration/review/sections/ReviewBusinessLocation", () => () => null);
jest.mock("../../components/registration/review/sections/ReviewBusinessPhotos", () => () => null);
jest.mock("../../components/registration/review/sections/ReviewOperatingHours", () => () => null);
jest.mock("../../components/registration/review/sections/ReviewVerificationDocuments", () => () => null);

describe("ApplicationSummaryScreen query states", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentState = {
      application: { id: 1 },
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
      isLoading: false,
      hasData: true,
      error: null,
      refetch: mockRefetchSpecialtyTags,
    };
  });

  it("waits for initial specialty-tag data", async () => {
    mockSpecialtyTagsState.isLoading = true;
    mockSpecialtyTagsState.hasData = false;

    await render(<ApplicationSummaryScreen />);

    expect(LoadingScreen).toHaveBeenCalled();
    expect(ReviewBusinessIdentity).not.toHaveBeenCalled();
  });

  it("shows a blocking retry when a required lookup has no data", async () => {
    mockSpecialtyTagsState.hasData = false;
    mockSpecialtyTagsState.error = new Error("Unavailable");

    await render(<ApplicationSummaryScreen />);

    expect(ErrorState).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Unable to load application",
      }),
      undefined,
    );
    expect(ReviewBusinessIdentity).not.toHaveBeenCalled();

    const retry = (ErrorState as jest.Mock).mock.lastCall[0].onPrimaryAction;
    retry();
    expect(mockRefetchSpecialtyTags).toHaveBeenCalledTimes(1);
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
