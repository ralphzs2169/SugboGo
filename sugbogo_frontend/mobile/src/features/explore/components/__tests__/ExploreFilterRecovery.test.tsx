import { createRef } from "react";
import { fireEvent, render } from "@testing-library/react-native";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";

import SearchFilterBottomSheet from "../search-filter-results/SearchFilterBottomSheet";

jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetModal: jest.requireActual("react-native").View,
  BottomSheetScrollView: jest.requireActual("react-native").View,
  BottomSheetBackdrop: () => null,
}));
jest.mock(
  "@/shared/components/AppText",
  () => jest.requireActual("react-native").Text,
);
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
jest.mock("@/shared/components/filters/TaxonomyFilterControls", () => {
  const { Text } = jest.requireActual("react-native");
  return () => <Text>Loaded taxonomy choices</Text>;
});

const options = { clusters: [], categories: [], specialty_tags: [] };
const props = {
  sheetRef: createRef<BottomSheetModal>(),
  options,
  draft: { search: "", clusterId: null, categoryIds: [], specialtyTagId: null },
  onChange: jest.fn(),
  onApply: jest.fn(),
};
const state = {
  options,
  hasOptions: false,
  isLoading: false,
  isPaused: false,
  error: new Error("Offline"),
  refetch: jest.fn(async () => ({}) as never),
};

it("offers Retry without treating failed taxonomy as selectable empty data", async () => {
  const screen = await render(
    <SearchFilterBottomSheet {...props} taxonomyState={state} />,
  );
  expect(screen.queryByText("Loaded taxonomy choices")).toBeNull();
  expect(screen.getByRole("button", { name: "Show results" })).toBeDisabled();
  await fireEvent.press(
    screen.getByRole("button", { name: "Retry loading filters" }),
  );
  expect(state.refetch).toHaveBeenCalledTimes(1);
  expect(props.onChange).not.toHaveBeenCalled();
  expect(props.onApply).not.toHaveBeenCalled();
  await screen.rerender(
    <SearchFilterBottomSheet
      {...props}
      taxonomyState={{ ...state, hasOptions: true }}
    />,
  );
  expect(screen.getByText("Loaded taxonomy choices")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Show results" })).toBeEnabled();
});

it("distinguishes loading options from a successful empty taxonomy", async () => {
  const screen = await render(
    <SearchFilterBottomSheet
      {...props}
      taxonomyState={{ ...state, error: null, isLoading: true }}
    />,
  );
  expect(
    screen.getByRole("progressbar", { name: "Loading filters" }),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Show results" })).toBeDisabled();
  await screen.rerender(
    <SearchFilterBottomSheet
      {...props}
      taxonomyState={{ ...state, error: null, hasOptions: true }}
    />,
  );
  expect(screen.getByText("No filters available yet.")).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Retry loading filters" }),
  ).toBeNull();
});
