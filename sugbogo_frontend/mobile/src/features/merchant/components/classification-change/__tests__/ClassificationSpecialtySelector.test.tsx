import React, { useState } from "react";
import { fireEvent, render } from "@testing-library/react-native";

import ClassificationSpecialtySelector from "../ClassificationSpecialtySelector";

const mockSheetProps = jest.fn();

jest.mock("@gorhom/bottom-sheet", () => {
  const { View } = jest.requireActual("react-native");
  return {
    BottomSheetModal: ({
      children,
      ...props
    }: {
      children: React.ReactNode;
    }) => {
      mockSheetProps(props);
      return <View>{children}</View>;
    },
    BottomSheetScrollView: ({
      children,
      testID,
    }: {
      children: React.ReactNode;
      testID?: string;
    }) => <View testID={testID}>{children}</View>,
    BottomSheetView: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
    BottomSheetBackdrop: () => null,
  };
});
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const tags = [1, 2, 3, 4].map((id) => ({
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
      screen.getByText("Select exactly 3 tags that describe your business."),
    ).toBeTruthy();
    expect(screen.getByTestId("classification-specialty-options")).toBeTruthy();
    expect(
      screen.getByLabelText("Tag 1").props.accessibilityState.selected,
    ).toBe(true);
    expect(screen.getByText("Done")).toBeTruthy();
  });

  it("prevents more than three tags and allows replacing one", async () => {
    const screen = await render(<SelectorHarness />);
    expect(screen.getAllByText("3 of 3 selected").length).toBeGreaterThan(0);
    expect(
      screen.getByLabelText("Tag 4").props.accessibilityState.disabled,
    ).toBe(true);
    await fireEvent.press(screen.getByLabelText("Tag 1"));
    expect(
      screen.getByLabelText("Tag 4").props.accessibilityState.disabled,
    ).toBe(false);
    await fireEvent.press(screen.getByLabelText("Tag 4"));
    expect(
      screen.getByLabelText("Tag 4").props.accessibilityState.selected,
    ).toBe(true);
    expect(screen.getAllByText("3 of 3 selected").length).toBeGreaterThan(0);
  });
});
