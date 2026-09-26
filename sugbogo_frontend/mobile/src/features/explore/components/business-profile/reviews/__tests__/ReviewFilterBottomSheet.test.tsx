import { act, fireEvent, render } from "@testing-library/react-native";

import type { BusinessReviewInsights } from "../../../../types/exploreBusiness.types";
import {
  DEFAULT_BUSINESS_REVIEW_FILTERS,
  type BusinessReviewFilters,
} from "../../../../types/review.types";
import ReviewFilterBottomSheet from "../review-collection/ReviewFilterBottomSheet";

jest.mock("expo-router", () => ({
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetModal: ({ children }: { children: React.ReactNode }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { View } = require("react-native");

    return <View>{children}</View>;
  },
  BottomSheetScrollView: ({ children }: { children: React.ReactNode }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { View } = require("react-native");

    return <View>{children}</View>;
  },
  BottomSheetBackdrop: () => null,
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));

const insights = {
  frequent_mentions: [{ label: "Friendly service", count: 8 }],
} as BusinessReviewInsights;

async function press(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(element);
  });
}

describe("ReviewFilterBottomSheet", () => {
  it("stages every filter until Apply commits the combined draft", async () => {
    const onApply = jest.fn();
    const screen = await render(
      <ReviewFilterBottomSheet
        sheetRef={{ current: null }}
        insights={insights}
        filters={DEFAULT_BUSINESS_REVIEW_FILTERS}
        onApply={onApply}
      />,
    );

    await press(screen.getByLabelText("Filter by Negative sentiment"));
    await press(screen.getByLabelText("Filter by Friendly service"));
    await press(screen.getByLabelText("With photos"));
    await press(screen.getByLabelText("With reply"));
    await press(screen.getByLabelText("Sort by Oldest"));

    expect(onApply).not.toHaveBeenCalled();
    await press(screen.getByLabelText("Apply review filters"));
    expect(onApply).toHaveBeenCalledWith({
      sentiment: "negative",
      topic: "Friendly service",
      hasPhotos: true,
      merchantReplied: true,
      ordering: "oldest",
    });
  });

  it("clears the draft without changing applied filters until Apply", async () => {
    const onApply = jest.fn();
    const filters: BusinessReviewFilters = {
      ...DEFAULT_BUSINESS_REVIEW_FILTERS,
      topic: "Friendly service",
      hasPhotos: true,
      ordering: "most_liked",
    };
    const screen = await render(
      <ReviewFilterBottomSheet
        sheetRef={{ current: null }}
        insights={insights}
        filters={filters}
        onApply={onApply}
      />,
    );

    expect(
      screen.getByLabelText("Filter by Friendly service, selected"),
    ).toBeTruthy();
    await press(screen.getByLabelText("Clear review filters"));
    expect(onApply).not.toHaveBeenCalled();
    await press(screen.getByLabelText("Apply review filters"));
    expect(onApply).toHaveBeenCalledWith({
      ...DEFAULT_BUSINESS_REVIEW_FILTERS,
      ordering: "most_liked",
    });
  });
});
