import { fireEvent, render } from "@testing-library/react-native";
import PhotoPreview from "../PhotoPreview";
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
test("photo preview exposes a named close button with an expanded press target", async () => {
  const screen = await render(<PhotoPreview uri="file:///photo.jpg" />);
  await fireEvent.press(screen.getByRole("button", { name: "Preview photo" }));
  const close = screen.getByRole("button", { name: "Close photo preview" });
  expect(close.props.hitSlop).toBe(10);
  await fireEvent.press(close);
  expect(
    screen.queryByRole("button", { name: "Close photo preview" }),
  ).toBeNull();
});
