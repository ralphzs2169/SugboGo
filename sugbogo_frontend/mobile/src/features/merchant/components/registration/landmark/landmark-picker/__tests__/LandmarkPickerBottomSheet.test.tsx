import {
  render,
  screen,
  fireEvent,
  cleanup,
} from "@testing-library/react-native";

import LandmarkPickerBottomSheet from "../LandmarkPickerBottomSheet";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const defaultProps = {
  keyboardHeight: 0,
  hasPendingLocation: true,
  landmarkName: "",
  landmarkNameError: undefined,
  landmarkRadiusLabel: "100 m",
  canSubmit: false,
  onNameChange: jest.fn(),
  onConfirm: jest.fn(),
};

afterEach(async () => {
  await cleanup();
});

describe("LandmarkPickerBottomSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows the instruction state before a pin is selected", async () => {
    await render(
      <LandmarkPickerBottomSheet
        {...defaultProps}
        hasPendingLocation={false}
      />,
    );

    expect(screen.queryByDisplayValue("")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add Landmark" })).toBeNull();
  });

  it("shows the naming form after a pin is selected", async () => {
    await render(<LandmarkPickerBottomSheet {...defaultProps} />);

    expect(screen.getByDisplayValue("").props.editable).toBe(true);
  });

  it("shows a validation error when provided", async () => {
    await render(
      <LandmarkPickerBottomSheet
        {...defaultProps}
        landmarkNameError="Please enter a landmark name."
      />,
    );

    expect(screen.getByText("Please enter a landmark name.")).toBeTruthy();
  });

  it("calls onNameChange when the user types", async () => {
    const onNameChange = jest.fn();

    await render(
      <LandmarkPickerBottomSheet
        {...defaultProps}
        onNameChange={onNameChange}
      />,
    );

    await fireEvent.changeText(screen.getByDisplayValue(""), "Front Gate");

    expect(onNameChange).toHaveBeenCalledWith("Front Gate");
  });

  it("calls onConfirm when Add Landmark is pressed", async () => {
    const onConfirm = jest.fn();

    await render(
      <LandmarkPickerBottomSheet
        {...defaultProps}
        canSubmit
        onConfirm={onConfirm}
      />,
    );

    await fireEvent.press(screen.getByText("Add Landmark"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
