import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";

import ClassificationChangeRequestScreen from "../ClassificationChangeRequestScreen";

const mockProfile = jest.fn();
const mockRequests = jest.fn();
const mockSubmit = jest.fn();
const mockReplace = jest.fn();
const mockRefetchRequests = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));
jest.mock("../../../hooks/business-profile/useMerchantBusinessProfile", () => ({
  __esModule: true,
  default: () => mockProfile(),
}));
jest.mock(
  "../../../hooks/classification-change/useMerchantClassificationChanges",
  () => ({
    useMerchantClassificationChangeRequests: () => mockRequests(),
    useSubmitMerchantClassificationChange: () => ({
      mutateAsync: mockSubmit,
      isPending: false,
    }),
  }),
);
jest.mock("../../../hooks/registration/useClusters", () => ({
  __esModule: true,
  default: () => ({
    clusters: [
      { id: 1, name: "Food" },
      { id: 5, name: "Culture" },
    ],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));
jest.mock("../../../hooks/registration/useCategories", () => ({
  __esModule: true,
  default: () => ({
    categories: [
      { id: 2, name: "Restaurants", cluster_id: 1 },
      { id: 4, name: "Creative Arts", cluster_id: 5 },
      { id: 6, name: "Cafes", cluster_id: 1 },
    ],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));
jest.mock("../../../hooks/registration/useSpecialtyTags", () => ({
  __esModule: true,
  default: () => ({
    specialtyTags: [1, 2, 3, 4].map((id) => ({
      id,
      name: `Tag ${id}`,
      color: "blue",
      icon: "tag",
    })),
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));
jest.mock("@/shared/components/bottom-sheets/SelectionBottomSheet", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return function MockSelectionSheet({ title, options, onSelect }: any) {
    return (
      <View>
        {options.map((option: any) => (
          <Pressable
            key={option.value}
            onPress={() => onSelect(option.value)}
            accessibilityLabel={`${title}: ${option.label}`}
          >
            <Text>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    );
  };
});
jest.mock(
  "../../../components/classification-change/ClassificationSpecialtySelector",
  () => {
    const { Pressable, Text, View } = jest.requireActual("react-native");
    return function MockSelector({ selectedIds, onChange, error }: any) {
      return (
        <View>
          <Text>{selectedIds.length} of 3 selected</Text>
          <Pressable onPress={() => onChange([1, 2, 4])}>
            <Text>Choose Tag 4</Text>
          </Pressable>
          {error ? <Text>{error}</Text> : null}
        </View>
      );
    };
  },
);
jest.mock("@/shared/hooks/useQueryErrorNotification", () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const business = {
  id: 10,
  status: "active",
  category: { id: 2, name: "Restaurants" },
  cluster: { id: 1, name: "Food" },
  specialty_tags: [1, 2, 3].map((id) => ({
    id,
    name: `Tag ${id}`,
    color: "blue",
    icon: "tag",
  })),
};

describe("ClassificationChangeRequestScreen", () => {
  afterEach(async () => {
    await cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockProfile.mockReturnValue({
      business,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockRequests.mockReturnValue({
      pendingRequest: null,
      isLoading: false,
      error: null,
      refetch: mockRefetchRequests,
    });
    mockSubmit.mockResolvedValue({ id: 7, status: "pending" });
  });

  it("prefills current values and rejects an unchanged proposal", async () => {
    const screen = await render(<ClassificationChangeRequestScreen />);
    expect(screen.getAllByText("Restaurants").length).toBeGreaterThan(0);
    expect(screen.getByText("3 of 3 selected")).toBeTruthy();
    await fireEvent.press(screen.getByText("Review Request"));
    expect(
      screen.getByText(/Make at least one classification change/),
    ).toBeTruthy();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("submits category-only changes with no cluster ID and keeps live data visible", async () => {
    const screen = await render(<ClassificationChangeRequestScreen />);
    await fireEvent.press(screen.getByLabelText("Select Category: Cafes"));
    expect(screen.getByText("Derived cluster: Food")).toBeTruthy();
    await fireEvent.press(screen.getByText("Review Request"));
    expect(screen.getByText("Requested Classification")).toBeTruthy();
    await fireEvent.press(screen.getByText("Submit Request"));
    await waitFor(() =>
      expect(mockSubmit).toHaveBeenCalledWith({
        proposed_category_id: 6,
        proposed_specialty_tag_ids: [1, 2, 3],
      }),
    );
    expect(screen.getByText("Current Classification")).toBeTruthy();
    expect(mockReplace).toHaveBeenCalledWith(
      "/(merchant)/business-update-requests/classification/7",
    );
  });

  it("derives the displayed cluster from a category across clusters", async () => {
    const screen = await render(<ClassificationChangeRequestScreen />);
    await fireEvent.press(screen.getByLabelText("Select Cluster: Culture"));
    await fireEvent.press(
      screen.getByLabelText("Select Category: Creative Arts"),
    );
    expect(screen.getByText("Derived cluster: Culture")).toBeTruthy();
    await fireEvent.press(screen.getByText("Review Request"));
    await fireEvent.press(screen.getByText("Submit Request"));
    await waitFor(() =>
      expect(mockSubmit).toHaveBeenCalledWith({
        proposed_category_id: 4,
        proposed_specialty_tag_ids: [1, 2, 3],
      }),
    );
  });

  it("prevents duplicate submissions while the first save is pending", async () => {
    let resolveSubmit: ((value: unknown) => void) | undefined;
    mockSubmit.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    const screen = await render(<ClassificationChangeRequestScreen />);
    await fireEvent.press(screen.getByLabelText("Select Category: Cafes"));
    await fireEvent.press(screen.getByText("Review Request"));
    const button = screen.getByRole("button", { name: "Submit Request" });
    await fireEvent.press(button);
    await fireEvent.press(button);
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    resolveSubmit?.({ id: 7, status: "pending" });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
  });

  it("allows specialty-only changes and maps backend tag errors", async () => {
    mockSubmit.mockRejectedValue({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Invalid specialties.",
      errors: { proposed_specialty_tag_ids: ["Choose valid specialty tags."] },
    });
    const screen = await render(<ClassificationChangeRequestScreen />);
    await fireEvent.press(screen.getByText("Choose Tag 4"));
    await fireEvent.press(screen.getByText("Review Request"));
    await fireEvent.press(screen.getByText("Submit Request"));
    await waitFor(() =>
      expect(screen.getByText("Choose valid specialty tags.")).toBeTruthy(),
    );
    expect(mockSubmit).toHaveBeenCalledWith({
      proposed_category_id: 2,
      proposed_specialty_tag_ids: [1, 2, 4],
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("maps a backend category error to category selection", async () => {
    mockSubmit.mockRejectedValue({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Invalid category.",
      errors: { proposed_category_id: ["Choose a valid category."] },
    });
    const screen = await render(<ClassificationChangeRequestScreen />);
    await fireEvent.press(screen.getByLabelText("Select Category: Cafes"));
    await fireEvent.press(screen.getByText("Review Request"));
    await fireEvent.press(screen.getByText("Submit Request"));
    await waitFor(() =>
      expect(
        screen.getAllByText("Choose a valid category.").length,
      ).toBeGreaterThan(0),
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("refreshes pending state after a duplicate pending rejection", async () => {
    mockSubmit.mockRejectedValue({
      success: false,
      code: "VALIDATION_ERROR",
      message: "A classification change request is already pending.",
      errors: {},
    });
    const screen = await render(<ClassificationChangeRequestScreen />);
    await fireEvent.press(screen.getByLabelText("Select Category: Cafes"));
    await fireEvent.press(screen.getByText("Review Request"));
    await fireEvent.press(screen.getByText("Submit Request"));
    await waitFor(() => expect(mockRefetchRequests).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/already pending/)).toBeTruthy();
  });

  it("blocks a second request while one is pending", async () => {
    mockRequests.mockReturnValue({
      pendingRequest: { id: 7, status: "pending" },
      isLoading: false,
      error: null,
      refetch: mockRefetchRequests,
    });
    const pending = await render(<ClassificationChangeRequestScreen />);
    expect(pending.getByText("Pending Admin review")).toBeTruthy();
    expect(pending.queryByText("Submit Request")).toBeNull();
  });

  it("blocks suspended businesses from submitting", async () => {
    mockProfile.mockReturnValue({
      business: { ...business, status: "suspended" },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    const suspended = await render(<ClassificationChangeRequestScreen />);
    expect(suspended.getByText("Request unavailable")).toBeTruthy();
    expect(suspended.queryByText("Submit Request")).toBeNull();
  });
});
