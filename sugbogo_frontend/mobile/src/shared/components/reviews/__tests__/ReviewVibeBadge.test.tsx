import { render } from "@testing-library/react-native";
import ReviewVibeBadge from "../ReviewVibeBadge";

describe("soft review vibe badge", () => {
  it.each([
    ["mostly_positive", "Mostly positive", "bg-success/10"],
    ["mostly_neutral", "Mostly neutral", "bg-slate-100"],
    ["mostly_negative", "Mostly negative", "bg-text-error/10"],
    ["mixed", "Mixed", "bg-amber-50"],
  ] as const)(
    "preserves the server label with a soft surface: %s",
    async (vibe, label, background) => {
      const screen = await render(
        <ReviewVibeBadge vibe={vibe} testID="vibe" />,
      );
      expect(screen.getByText(label)).toBeTruthy();
      expect(screen.getByLabelText(`Customer feedback: ${label}`)).toBeTruthy();
      expect(screen.getByTestId("vibe").props.className).toContain(background);
      expect(screen.getByText(label).props.className).not.toContain(
        "text-white",
      );
      expect(screen.queryByRole("button")).toBeNull();
    },
  );

  it.each([null, undefined])("omits an unavailable label: %s", async (vibe) => {
    const screen = await render(<ReviewVibeBadge vibe={vibe} />);
    expect(screen.toJSON()).toBeNull();
  });
});
