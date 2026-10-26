import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { BackHandler } from "react-native";

import type { ExploreFilterOptions } from "@/features/explore/types/exploreBusiness.types";

import {
  DEFAULT_COMMUNITY_REVIEW_FILTERS,
  type CommunityReviewFilters,
} from "../../types/communityReview.types";
import CommunityFilterBottomSheet from "../CommunityFilterBottomSheet";

jest.mock("expo-router", () => ({
  useNavigation: () => ({ isFocused: () => true }),
  useIsFocused: () => true,
}));
jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetModal: ({
    children,
    onChange,
    onDismiss,
  }: {
    children: React.ReactNode;
    onChange: (index: number) => void;
    onDismiss: () => void;
  }) => {
    const { View } = jest.requireActual("react-native");
    return (
      <View testID="mock-sheet" onChange={onChange} onDismiss={onDismiss}>
        {children}
      </View>
    );
  },
  BottomSheetScrollView: ({ children }: { children: React.ReactNode }) => {
    const { View } = jest.requireActual("react-native");
    return <View>{children}</View>;
  },
  BottomSheetBackdrop: () => null,
  BottomSheetTextInput: (props: Record<string, unknown>) => {
    const { TextInput } = jest.requireActual("react-native");
    return <TextInput {...props} />;
  },
}));
jest.mock("react-native-gesture-handler", () => ({
  ScrollView: ({ children }: { children: React.ReactNode }) => {
    const { View } = jest.requireActual("react-native");
    return <View>{children}</View>;
  },
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: () => null,
}));

const options: ExploreFilterOptions = {
  clusters: [
    { id: 1, name: "Food", icon: "utensils" },
    { id: 2, name: "Arts", icon: "palette" },
  ],
  categories: [
    { id: 11, name: "Cafe", cluster_id: 1 },
    { id: 12, name: "Restaurant", cluster_id: 1 },
    { id: 21, name: "Gallery", cluster_id: 2 },
  ],
  specialty_tags: [
    { id: 31, name: "Coffee", color: "green", icon: "coffee" },
    { id: 32, name: "Art", color: "purple", icon: "palette" },
  ],
};

async function press(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => fireEvent.press(element));
}

function renderSheet(
  onApply = jest.fn(),
  filters: CommunityReviewFilters = DEFAULT_COMMUNITY_REVIEW_FILTERS,
  filterOptions = options,
) {
  return render(
    <CommunityFilterBottomSheet
      sheetRef={{ current: null }}
      filters={filters}
      options={filterOptions}
      isLoading={false}
      error={null}
      onRetry={jest.fn()}
      onApply={onApply}
    />,
  );
}

describe("CommunityFilterBottomSheet", () => {
  it("consumes Back while open and discards un-applied draft selections", async () => {
    const remove = jest.fn();
    const addListener = jest
      .spyOn(BackHandler, "addEventListener")
      .mockReturnValue({ remove });
    const dismiss = jest.fn();
    const onApply = jest.fn();
    const screen = await render(
      <CommunityFilterBottomSheet
        sheetRef={{ current: { dismiss } as unknown as BottomSheetModal }}
        filters={DEFAULT_COMMUNITY_REVIEW_FILTERS}
        options={options}
        isLoading={false}
        error={null}
        onRetry={jest.fn()}
        onApply={onApply}
      />,
    );

    await fireEvent(screen.getByTestId("mock-sheet"), "onChange", 0);
    await press(screen.getByText("Cafe"));
    // A repeated sheet-position notification must not erase the open draft.
    await fireEvent(screen.getByTestId("mock-sheet"), "onChange", 0);
    expect(
      screen.getByRole("button", { name: "Cafe" }).props.accessibilityState,
    ).toEqual({ selected: true });
    const handleBack = addListener.mock.calls.at(-1)![1];
    expect(
      handleBack({ type: "hardwareBackPress", timeStamp: Date.now() }),
    ).toBe(true);
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();

    await fireEvent(screen.getByTestId("mock-sheet"), "onDismiss");
    expect(remove).toHaveBeenCalledTimes(1);
    await fireEvent(screen.getByTestId("mock-sheet"), "onChange", 0);
    await press(screen.getByText("Apply"));
    expect(onApply).toHaveBeenCalledWith(DEFAULT_COMMUNITY_REVIEW_FILTERS);
    addListener.mockRestore();
  });

  it("stages category and vouched-specialty choices until Apply", async () => {
    const onApply = jest.fn();
    const screen = await renderSheet(onApply);
    await press(screen.getByText("Food"));
    await press(screen.getByText("Cafe"));
    await press(screen.getByText("Restaurant"));
    await press(screen.getByText("Coffee"));
    await press(screen.getByText("With photos"));
    await press(screen.getByText("Most Helpful"));
    expect(onApply).not.toHaveBeenCalled();
    await press(screen.getByText("Apply"));
    expect(onApply).toHaveBeenCalledWith({
      ordering: "most_helpful",
      clusterId: 1,
      categoryIds: [11, 12],
      specialtyTagId: 31,
      hasPhotos: true,
    });
  });

  it("clears incompatible categories on cluster change and preserves sorting on Reset", async () => {
    const onApply = jest.fn();
    const screen = await renderSheet(onApply, {
      ordering: "most_helpful",
      clusterId: 1,
      categoryIds: [11],
      specialtyTagId: 31,
      hasPhotos: true,
    });
    await press(screen.getByText("Arts"));
    expect(screen.queryByText("Cafe")).toBeNull();
    await press(screen.getByText("Reset"));
    await press(screen.getByText("Apply"));
    expect(onApply).toHaveBeenCalledWith({
      ordering: "most_helpful",
      clusterId: null,
      categoryIds: [],
      specialtyTagId: null,
      hasPhotos: false,
    });
  });

  it("restores applied filters when the sheet opens again", async () => {
    const onApply = jest.fn();
    const screen = await renderSheet(onApply);
    await press(screen.getByText("Cafe"));
    await act(async () => {
      fireEvent(screen.getByTestId("mock-sheet"), "onChange", 0);
    });
    await press(screen.getByText("Apply"));
    expect(onApply).toHaveBeenCalledWith(DEFAULT_COMMUNITY_REVIEW_FILTERS);
  });

  it("keeps only one vouched specialty and allows clearing it", async () => {
    const onApply = jest.fn();
    const screen = await renderSheet(onApply);
    await press(screen.getByText("Coffee"));
    await press(screen.getByText("Art"));
    await press(screen.getByText("Apply"));
    expect(onApply).toHaveBeenCalledWith({
      ...DEFAULT_COMMUNITY_REVIEW_FILTERS,
      specialtyTagId: 32,
    });

    await press(screen.getByText("Any specialty"));
    await press(screen.getByText("Apply"));
    expect(onApply).toHaveBeenLastCalledWith(DEFAULT_COMMUNITY_REVIEW_FILTERS);
  });

  it("searches taxonomy options locally", async () => {
    const manyOptions = {
      ...options,
      categories: [
        ...options.categories,
        ...Array.from({ length: 11 }, (_, index) => ({
          id: 100 + index,
          name: `Other ${index}`,
          cluster_id: 1,
        })),
      ],
    };
    const screen = await renderSheet(jest.fn(), undefined, manyOptions);
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText("Search filters"), "Gallery");
    });
    await waitFor(() => {
      expect(screen.getByText("Gallery")).toBeTruthy();
      expect(screen.queryByText("Cafe")).toBeNull();
    });
  });

  it("shows a retry action when taxonomy retrieval fails", async () => {
    const onRetry = jest.fn();
    const screen = await render(
      <CommunityFilterBottomSheet
        sheetRef={{ current: null }}
        filters={DEFAULT_COMMUNITY_REVIEW_FILTERS}
        options={{ clusters: [], categories: [], specialty_tags: [] }}
        isLoading={false}
        error={new Error("Offline")}
        onRetry={onRetry}
        onApply={jest.fn()}
      />,
    );
    expect(screen.getByText("Could not load filter options.")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Retry loading filter options" }),
    ).toBeTruthy();
    await press(screen.getByText("Retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows taxonomy loading without treating it as an empty result", async () => {
    const screen = await render(
      <CommunityFilterBottomSheet
        sheetRef={{ current: null }}
        filters={DEFAULT_COMMUNITY_REVIEW_FILTERS}
        options={{ clusters: [], categories: [], specialty_tags: [] }}
        isLoading
        error={null}
        onRetry={jest.fn()}
        onApply={jest.fn()}
      />,
    );
    expect(screen.getByText("Loading filter options…")).toBeTruthy();
    expect(screen.queryByText("No categories available.")).toBeNull();
  });
});
