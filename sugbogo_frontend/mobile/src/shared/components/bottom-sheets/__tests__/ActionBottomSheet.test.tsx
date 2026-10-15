import { act, fireEvent, render } from "@testing-library/react-native";
import ActionBottomSheet from "../ActionBottomSheet";

let mockOnDismiss: (() => void) | undefined;
jest.mock("@gorhom/bottom-sheet", () => {
  const { View } = jest.requireActual("react-native");
  return {
    BottomSheetBackdrop: () => null,
    BottomSheetView: View,
    BottomSheetModal: ({
      children,
      onDismiss,
    }: {
      children: React.ReactNode;
      onDismiss?: () => void;
    }) => {
      mockOnDismiss = onDismiss;
      return <View>{children}</View>;
    },
  };
});
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 20 }),
}));

describe("ActionBottomSheet accessibility and dismissal", () => {
  it("announces actions as buttons and closes before selecting", async () => {
    const dismiss = jest.fn();
    const onSelect = jest.fn();
    const onDismiss = jest.fn();
    const screen = await render(
      <ActionBottomSheet
        sheetRef={{ current: { dismiss } } as never}
        options={[{ label: "Edit my review", value: "edit" }]}
        onSelect={onSelect}
        onDismiss={onDismiss}
      />,
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Edit my review" }),
    );
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("edit");
    await act(async () => {
      mockOnDismiss?.();
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("cancels without selecting an action", async () => {
    const dismiss = jest.fn();
    const onSelect = jest.fn();
    const screen = await render(
      <ActionBottomSheet
        sheetRef={{ current: { dismiss } } as never}
        options={[{ label: "Delete review", value: "delete" }]}
        onSelect={onSelect}
      />,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
