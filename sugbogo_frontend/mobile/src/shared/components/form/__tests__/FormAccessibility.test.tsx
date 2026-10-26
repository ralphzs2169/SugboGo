import { render } from "@testing-library/react-native";
import FormInput from "../FormInput";
import FormTextArea from "../FormTextArea";
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
test.each([FormInput, FormTextArea])(
  "derives an accessible name and required/error context without helper duplication",
  async (Component) => {
    const screen = await render(
      <Component
        label="Business description"
        value="My shop"
        required
        error="Describe your business"
        helperText="Decorative helper"
      />,
    );
    const input = screen.getByLabelText("Business description");
    expect(input.props.accessibilityHint).toBe(
      "Required field. Error: Describe your business",
    );
    expect(input.props.value).toBe("My shop");
    expect(screen.getByText("Describe your business")).toBeTruthy();
  },
);
test.each([FormInput, FormTextArea])(
  "preserves explicit names/hints and communicates disabled state",
  async (Component) => {
    const screen = await render(
      <Component
        label="Name"
        accessibilityLabel="Merchant name"
        accessibilityHint="Use your registered name."
        editable={false}
        value="Sugbo shop"
      />,
    );
    const input = screen.getByLabelText("Merchant name");
    expect(input.props.accessibilityHint).toBe("Use your registered name.");
    expect(input.props.accessibilityState.disabled).toBe(true);
    expect(input.props.editable).toBe(false);
  },
);
test("hidden textarea label still names its native input", async () => {
  const screen = await render(
    <FormTextArea
      label="Reply"
      showLabel={false}
      helperText="Optional guidance"
      value="Thank you"
    />,
  );
  expect(
    screen.getByLabelText("Reply").props.accessibilityHint,
  ).toBeUndefined();
  expect(screen.getByText("Optional guidance")).toBeTruthy();
});
