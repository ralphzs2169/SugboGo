import React, { useState } from "react";
import { fireEvent, render } from "@testing-library/react-native";

import ClassificationSpecialtySelector from "../ClassificationSpecialtySelector";

const mockSheetProps = jest.fn();

jest.mock("@gorhom/bottom-sheet", () => {
  const { View } = jest.requireActual("react-native");
  return {
    BottomSheetModal: ({
      children,
      footerComponent: Footer,
      ...props
    }: {
      children: React.ReactNode;
      footerComponent?: React.ComponentType<any>;
    }) => {
      mockSheetProps({ ...props, footerComponent: Footer });
      return (
        <View>
          {children}
          {Footer ? <Footer animatedFooterPosition={{}} /> : null}
        </View>
      );
    },
    BottomSheetScrollView: ({
      children,
      testID,
      enableFooterMarginAdjustment,
    }: {
      children: React.ReactNode;
      testID?: string;
      enableFooterMarginAdjustment?: boolean;
    }) => (
      <View
        testID={testID}
        accessibilityHint={
          enableFooterMarginAdjustment ? "footer-adjusted" : undefined
        }
      >
        {children}
      </View>
    ),
    BottomSheetView: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
    BottomSheetFooter: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
    BottomSheetBackdrop: () => null,
  };
});
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const tags = [1, 2, 3, 4, 5, 6].map((id) => ({
  id,
  name: `Tag ${id}`,
  color: "blue" as const,
  icon: "tag" as const,
}));

/** Keeps the test selection controlled by its parent, as in the request form. */
function SelectorHarness() {
  const [selectedIds, setSelectedIds] = useState([1, 2, 3]);
  return (
    <ClassificationSpecialtySelector
      tags={tags}
      selectedIds={selectedIds}
      onChange={setSelectedIds}
    />
  );
}

describe("ClassificationSpecialtySelector", () => {
  beforeEach(() => mockSheetProps.mockClear());

  it("opens at Registration's tall snap with a visible scrollable list and selected count", async () => {
    const screen = await render(<SelectorHarness />);

    expect(mockSheetProps).toHaveBeenCalledWith(
      expect.objectContaining({
        index: 1,
        enableDynamicSizing: false,
        snapPoints: ["70%", "85%"],
      }),
    );
    expect(screen.getByText("Specialty Tags")).toBeTruthy();
    expect(
      screen.getByText("Deselect a specialty to choose a different one."),
    ).toBeTruthy();
    expect(screen.getByTestId("classification-specialty-options")).toBeTruthy();
    expect(
      screen.getByTestId("classification-specialty-options").props
        .accessibilityHint,
    ).toBe("footer-adjusted");
    expect(
      screen.getByLabelText("Tag 1").props.accessibilityState.selected,
    ).toBe(true);
    expect(screen.getByText("Done")).toBeTruthy();
  });

  it("keeps the complete list visible while disabling only unselected tags at the limit", async () => {
    const screen = await render(<SelectorHarness />);
    expect(screen.getAllByText("3 of 3 selected").length).toBeGreaterThan(0);

    for (const id of [1, 2, 3]) {
      const option = screen.getByLabelText(`Tag ${id}`);
      expect(option.props.accessibilityState.selected).toBe(true);
      expect(option.props.accessibilityState.disabled).toBe(false);
    }
    for (const id of [4, 5, 6]) {
      const option = screen.getByLabelText(`Tag ${id}`);
      expect(option).toBeTruthy();
      expect(option.props.accessibilityState.selected).toBe(false);
      expect(option.props.accessibilityState.disabled).toBe(true);
    }
  });

  it("reenables every unselected option before selecting a replacement", async () => {
    const screen = await render(<SelectorHarness />);

    await fireEvent.press(screen.getByLabelText("Tag 3"));
    expect(screen.getAllByText("2 of 3 selected").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Select exactly 3 tags that describe your business."),
    ).toBeTruthy();
    for (const id of [3, 4, 5, 6]) {
      expect(
        screen.getByLabelText(`Tag ${id}`).props.accessibilityState.disabled,
      ).toBe(false);
    }

    await fireEvent.press(screen.getByLabelText("Tag 4"));
    expect(screen.getByLabelText("Tag 4").props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true, disabled: false }),
    );
    for (const id of [3, 5, 6]) {
      const option = screen.getByLabelText(`Tag ${id}`);
      expect(option).toBeTruthy();
      expect(option.props.accessibilityState.disabled).toBe(true);
    }
    expect(screen.getAllByText("3 of 3 selected").length).toBeGreaterThan(0);
  });
});
