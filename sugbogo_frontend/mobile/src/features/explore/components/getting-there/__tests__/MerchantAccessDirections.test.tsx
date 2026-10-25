import { fireEvent, render } from "@testing-library/react-native";

import MerchantAccessDirections from "../MerchantAccessDirections";

it.each([undefined, null, "", " \n \t "])(
  "hides absent or blank merchant directions (%s)",
  async (directions) => {
    const screen = await render(
      <MerchantAccessDirections directions={directions} />,
    );
    expect(screen.queryByText("Merchant-provided")).toBeNull();
    expect(screen.queryByRole("header")).toBeNull();
  },
);

it("preserves multiline plain text with attribution, a heading and selection", async () => {
  const directions = "Use the gate.\nWalk behind the chapel.";
  const screen = await render(
    <MerchantAccessDirections directions={`  ${directions}  `} />,
  );
  expect(screen.getByRole("header", { name: "Access notes" })).toBeTruthy();
  expect(screen.getByText("Merchant-provided")).toBeTruthy();
  expect(screen.queryByText("How to reach us")).toBeNull();
  expect(screen.getByText(directions).props.selectable).toBe(true);
  await fireEvent(screen.getByText(directions), "textLayout", {
    nativeEvent: { lines: Array(3).fill({ text: "A rendered line" }) },
  });
  expect(screen.queryByText("Read more")).toBeNull();
});

it("collapses notes exceeding four rendered lines and allows full reading", async () => {
  const directions =
    "Walk around the chapel.\nUse the side entrance.\nAsk at the blue gate.";
  const screen = await render(
    <MerchantAccessDirections directions={directions} />,
  );
  await fireEvent(screen.getByText(directions), "textLayout", {
    nativeEvent: { lines: Array(5).fill({ text: "A rendered line" }) },
  });
  expect(screen.getByText(directions).props.numberOfLines).toBe(4);
  await fireEvent.press(
    screen.getByRole("button", { name: "Read more access notes" }),
  );
  expect(screen.getByText(directions).props.numberOfLines).toBeUndefined();
  expect(
    screen.getByRole("button", { name: "Show less of access notes" }).props
      .accessibilityState.expanded,
  ).toBe(true);
  await fireEvent.press(screen.getByText("Show less"));
  expect(screen.getByText(directions).props.numberOfLines).toBe(4);
  await screen.rerender(
    <MerchantAccessDirections directions="New short note." />,
  );
  expect(screen.queryByText("Read more")).toBeNull();
  expect(
    screen.getByText("New short note.").props.numberOfLines,
  ).toBeUndefined();
});

it("keeps the full note visible when its parent already provides scrolling", async () => {
  const directions = "Use the chapel entrance.\n".repeat(25).trim();
  const screen = await render(
    <MerchantAccessDirections directions={directions} collapsible={false} />,
  );
  await fireEvent(screen.getByText(directions), "textLayout", {
    nativeEvent: { lines: Array(25).fill({ text: "A rendered line" }) },
  });
  expect(screen.getByText(directions).props.numberOfLines).toBeUndefined();
  expect(screen.queryByText("Read more")).toBeNull();
});
