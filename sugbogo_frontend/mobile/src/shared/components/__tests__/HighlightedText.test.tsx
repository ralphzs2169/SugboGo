import { render } from "@testing-library/react-native";

import AppText from "../AppText";
import HighlightedText from "../HighlightedText";

it.each([
  ["Coffee Corner", "coffee", ["Coffee"]],
  ["Coffee Corner", "coffe", ["Coffe"]],
  ["Coffee and COFFEE", " coffee ", ["Coffee", "COFFEE"]],
  ["C++ [Cafe]. C++ [CAFE].", "C++ [cafe].", ["C++ [Cafe].", "C++ [CAFE]."]],
])(
  "highlights literal matches in %s without changing casing",
  async (text, query, expected) => {
    const screen = await render(
      <AppText accessibilityLabel={text}>
        <HighlightedText text={text} query={query} />
      </AppText>,
    );

    expect(
      screen
        .getAllByTestId("literal-text-highlight")
        .map((match) => match.props.children),
    ).toEqual(expected);
    expect(screen.getByLabelText(text)).toBeTruthy();
  },
);

it.each(["", "   ", "advventre", ".*", "["])(
  "does not fabricate a match for %s",
  async (query) => {
    const screen = await render(
      <AppText>
        <HighlightedText text="Adventure" query={query} />
      </AppText>,
    );

    expect(screen.queryAllByTestId("literal-text-highlight")).toHaveLength(0);
    expect(screen.getByText("Adventure")).toBeTruthy();
  },
);
