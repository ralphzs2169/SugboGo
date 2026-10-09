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
const mockPush = jest.fn();
const mockRefetchRequests = jest.fn();
const mockSpecialtyTags = jest.fn();
const mockSelectorProps = jest.fn();
const mockBack = jest.fn();
const mockSetOptions = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    back: () => mockBack(),
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
  useNavigation: () => ({ setOptions: mockSetOptions }),
  useFocusEffect: (callback: () => void) =>
    jest.requireActual("react").useEffect(callback, [callback]),
}));
jest.mock(
  "expo-router/build/react-navigation/elements/Header/HeaderBackButton",
  () => ({
    HeaderBackButton: ({ onPress }: { onPress: () => void }) => {
      const { Pressable, Text } = jest.requireActual("react-native");
      return (
        <Pressable onPress={onPress} accessibilityLabel="Back">
          <Text>Back</Text>
        </Pressable>
      );
    },
  }),
);
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
      { id: 1, name: "Food", icon: "utensils" },
      { id: 5, name: "Culture", icon: "landmark" },
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
    specialtyTags: mockSpecialtyTags(),
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
    return function MockSelector({ tags, selectedIds, onChange, error }: any) {
      mockSelectorProps({ tags, selectedIds });
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

const eligible = {
  can_submit: true,
  reason: null,
  cooldown_duration_hours: 168,
  cooldown_until: null,
  last_approved_request_id: null,
  pending_request_id: null,
};

describe("ClassificationChangeRequestScreen", () => {
  afterEach(async () => {
    await cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSpecialtyTags.mockReturnValue(
      [1, 2, 3, 4].map((id) => ({
        id,
        name: `Tag ${id}`,
        color: "blue",
        icon: "tag",
      })),
    );
    mockProfile.mockReturnValue({
      business,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockRequests.mockReturnValue({
      eligibility: eligible,
      pendingRequest: null,
      hasData: true,
      isLoading: false,
      error: null,
      refetch: mockRefetchRequests,
    });
    mockSubmit.mockResolvedValue({ id: 7, status: "pending" });
  });

  it("passes all live specialties as selected options even when lookup omits two", async () => {
    mockSpecialtyTags.mockReturnValue(
      [3, 4, 5, 6].map((id) => ({
        id,
        name: `Tag ${id}`,
        color: "blue",
        icon: "tag",
      })),
    );

    await render(<ClassificationChangeRequestScreen />);
    await waitFor(() =>
      expect(mockSelectorProps).toHaveBeenCalledWith({
        tags: expect.arrayContaining([
          expect.objectContaining({ id: 1, name: "Tag 1" }),
          expect.objectContaining({ id: 2, name: "Tag 2" }),
          expect.objectContaining({ id: 3, name: "Tag 3" }),
          expect.objectContaining({ id: 4, name: "Tag 4" }),
          expect.objectContaining({ id: 5, name: "Tag 5" }),
          expect.objectContaining({ id: 6, name: "Tag 6" }),
        ]),
        selectedIds: [1, 2, 3],
      }),
    );
    const latestProps = mockSelectorProps.mock.lastCall?.[0];
    expect(latestProps.tags.map((tag: { id: number }) => tag.id)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });

  it("uses the registration cluster icon in the live summary", async () => {
    const screen = await render(<ClassificationChangeRequestScreen />);
    expect(screen.getByTestId("live-cluster-icon")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Current classification"));
    expect(screen.getByText("Tag 1")).toBeTruthy();
  });

  it("prefills current values and rejects an unchanged proposal", async () => {
    const screen = await render(<ClassificationChangeRequestScreen />);
    expect(screen.getAllByText("Restaurants").length).toBeGreaterThan(0);
    expect(screen.getByText("3 of 3 selected")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Review Changes" }).props
        .accessibilityState.disabled,
    ).toBe(true);
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("submits category-only changes with no cluster ID and keeps live data visible", async () => {
    const screen = await render(<ClassificationChangeRequestScreen />);
    await fireEvent.press(screen.getByLabelText("Select Category: Cafes"));
    await fireEvent.press(screen.getByText("Review Changes"));
    expect(screen.getByText("Category change")).toBeTruthy();
    expect(screen.queryByText("Specialty changes")).toBeNull();
    await fireEvent.press(screen.getByText("Submit Request"));
    await waitFor(() =>
      expect(mockSubmit).toHaveBeenCalledWith({
        proposed_category_id: 6,
        proposed_specialty_tag_ids: [1, 2, 3],
      }),
    );
    expect(screen.getAllByText("Currently live").length).toBeGreaterThan(0);
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
    await fireEvent.press(screen.getByText("Review Changes"));
    expect(screen.getAllByText("Culture").length).toBeGreaterThan(0);
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
    await fireEvent.press(screen.getByText("Review Changes"));
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
    await fireEvent.press(screen.getByText("Review Changes"));
    expect(screen.getByText("Specialty changes")).toBeTruthy();
    expect(screen.queryByText("Category change")).toBeNull();
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
    await fireEvent.press(screen.getByText("Review Changes"));
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
    await fireEvent.press(screen.getByText("Review Changes"));
    await fireEvent.press(screen.getByText("Submit Request"));
    await waitFor(() => expect(mockRefetchRequests).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/already pending/)).toBeTruthy();
  });

  it("blocks a second request while one is pending", async () => {
    mockRequests.mockReturnValue({
      eligibility: {
        ...eligible,
        can_submit: false,
        reason: "pending",
        pending_request_id: 7,
      },
      pendingRequest: { id: 7, status: "pending" },
      hasData: true,
      isLoading: false,
      error: null,
      refetch: mockRefetchRequests,
    });
    const pending = await render(<ClassificationChangeRequestScreen />);
    expect(pending.getByText("Pending Admin review")).toBeTruthy();
    expect(pending.queryByText("Submit Request")).toBeNull();
  });

  it("shows classification cooldown and opens the approved request", async () => {
    mockRequests.mockReturnValue({
      eligibility: {
        can_submit: false,
        reason: "cooldown",
        cooldown_duration_hours: 168,
        cooldown_until: "2026-10-16T07:00:00Z",
        last_approved_request_id: 52,
        pending_request_id: null,
      },
      pendingRequest: null,
      hasData: true,
      isLoading: false,
      error: null,
      refetch: mockRefetchRequests,
    });

    const screen = await render(<ClassificationChangeRequestScreen />);

    expect(screen.getByText("Change temporarily unavailable")).toBeTruthy();
    expect(screen.getByText("7 days")).toBeTruthy();
    expect(screen.queryByText("Review Changes")).toBeNull();
    await fireEvent.press(screen.getByText("View Approved Request"));
    expect(mockPush).toHaveBeenCalledWith(
      "/(merchant)/business-update-requests/classification/52",
    );
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

  it("exits immediately when nothing has changed", async () => {
    const screen = await render(<ClassificationChangeRequestScreen />);
    await fireEvent.press(screen.getByText("Cancel"));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Discard classification changes?")).toBeNull();
  });

  it("confirms discarding a changed draft from Cancel", async () => {
    const screen = await render(<ClassificationChangeRequestScreen />);
    await fireEvent.press(screen.getByLabelText("Select Category: Cafes"));
    await fireEvent.press(screen.getByText("Cancel"));
    expect(screen.getByText("Discard classification changes?")).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText("Discard"));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("confirms discarding a changed draft from the header Back", async () => {
    const screen = await render(<ClassificationChangeRequestScreen />);
    await fireEvent.press(screen.getByLabelText("Select Category: Cafes"));
    const headerLeft = mockSetOptions.mock.lastCall?.[0].headerLeft;
    const header = await render(headerLeft());
    await fireEvent.press(header.getByLabelText("Back"));
    expect(screen.getByText("Discard classification changes?")).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });
});
