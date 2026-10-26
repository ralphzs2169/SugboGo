import { fireEvent, render } from "@testing-library/react-native";

import MapControls from "../MapControls";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));

it("exposes location checks as busy and disabled, then restores the location action", async () => {
  const onLocateMe = jest.fn();
  const screen = await render(<MapControls onLocateMe={onLocateMe} />);
  await fireEvent.press(screen.getByRole("button", { name: "Locate me" }));
  expect(onLocateMe).toHaveBeenCalledTimes(1);

  await screen.rerender(<MapControls onLocateMe={onLocateMe} isLocating />);
  const pendingControl = screen.getByRole("button", {
    name: "Checking your location",
    disabled: true,
    busy: true,
  });
  await fireEvent.press(pendingControl);
  expect(onLocateMe).toHaveBeenCalledTimes(1);

  await screen.rerender(<MapControls onLocateMe={onLocateMe} />);
  await fireEvent.press(screen.getByRole("button", {
    name: "Locate me",
    disabled: false,
    busy: false,
  }));
  expect(onLocateMe).toHaveBeenCalledTimes(2);
});
