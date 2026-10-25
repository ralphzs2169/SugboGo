import { render } from "@testing-library/react-native";

import MerchantAccessDirections from "../MerchantAccessDirections";

it.each([undefined, null, "", " \n \t "])(
  "hides absent or blank merchant directions (%s)",
  async (directions) => {
    const screen = await render(
      <MerchantAccessDirections directions={directions} />,
    );
    expect(screen.queryByText("Merchant-provided directions")).toBeNull();
    expect(screen.queryByRole("header")).toBeNull();
  },
);

it("preserves multiline plain text with attribution, a heading and selection", async () => {
  const directions = "Use the gate.\nWalk behind the chapel.";
  const screen = await render(
    <MerchantAccessDirections directions={`  ${directions}  `} />,
  );
  expect(screen.getByRole("header", { name: "How to reach us" })).toBeTruthy();
  expect(screen.getByText("Merchant-provided directions")).toBeTruthy();
  expect(screen.getByText(directions).props.selectable).toBe(true);
});
