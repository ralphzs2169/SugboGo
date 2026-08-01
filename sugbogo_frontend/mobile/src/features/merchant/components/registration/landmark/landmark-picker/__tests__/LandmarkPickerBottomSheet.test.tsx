import { render, screen, fireEvent } from "@testing-library/react-native";

import LandmarkPickerBottomSheet from "../LandmarkPickerBottomSheet";
import { cleanup } from "@testing-library/react-native";

const defaultProps = {
  keyboardHeight: 0,
  hasPendingLocation: true,
  landmarkName: "",
  landmarkNameError: undefined,
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

    expect(screen.getByText("Tap the map to place a landmark")).toBeTruthy();

    expect(screen.queryByPlaceholderText("e.g. Front Gate")).toBeNull();
  });

  it("shows the naming form after a pin is selected", async () => {
    const screenResult = await render(
      <LandmarkPickerBottomSheet {...defaultProps} />,
    );

    expect(screenResult.getByText("Name your landmark")).toBeTruthy();

    expect(screen.getByText("Name your landmark")).toBeTruthy();

    expect(screen.getByPlaceholderText("e.g. Front Gate")).toBeTruthy();
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

    fireEvent.changeText(
      screen.getByPlaceholderText("e.g. Front Gate"),
      "Front Gate",
    );

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

    fireEvent.press(screen.getByText("Add Landmark"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
