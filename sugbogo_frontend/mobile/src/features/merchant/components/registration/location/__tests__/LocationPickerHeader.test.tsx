import { act, fireEvent, render } from "@testing-library/react-native";

import LocationPickerHeader from "../LocationPickerHeader";

jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native");

  return { SafeAreaView: View };
});

describe("LocationPickerHeader", () => {
  it("opens place search through the header trigger and keeps Back separate", async () => {
    const onSearch = jest.fn();
    const onClose = jest.fn();
    const screen = await render(
      <LocationPickerHeader onSearch={onSearch} onClose={onClose} />,
    );

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Search your business location"));
    });
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(
        screen.getByLabelText("Go back without changing business location"),
      );
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
