import { act, fireEvent, render } from "@testing-library/react-native";

import ExploreFilterOptionsFeedback from "../ExploreFilterOptionsFeedback";

jest.mock(
  "@/shared/components/AppText",
  () => jest.requireActual("react-native").Text,
);

const options = { clusters: [], categories: [], specialty_tags: [] };
const refetch = jest.fn(async () => undefined);
const state = {
  options,
  hasOptions: false,
  isLoading: false,
  isPaused: false,
  error: null,
  refetch,
};

it("distinguishes unresolved, successful empty, and failed taxonomy", async () => {
  const screen = await render(
    <ExploreFilterOptionsFeedback state={{ ...state, isLoading: true }} />,
  );
  expect(
    screen.getByRole("progressbar", { name: "Loading filters" }),
  ).toBeTruthy();
  expect(screen.queryByText("No filters available yet.")).toBeNull();
  await screen.rerender(
    <ExploreFilterOptionsFeedback state={{ ...state, hasOptions: true }} />,
  );
  expect(screen.getByText("No filters available yet.")).toBeTruthy();
  await screen.rerender(
    <ExploreFilterOptionsFeedback
      state={{ ...state, error: new Error("Offline") }}
    />,
  );
  expect(screen.queryByText("No filters available yet.")).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Retry loading filters" }),
  );
  expect(refetch).toHaveBeenCalledTimes(1);
});

it("keeps cached taxonomy available and guards repeated recovery presses", async () => {
  let finish!: () => void;
  refetch.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  const screen = await render(
    <ExploreFilterOptionsFeedback
      state={{ ...state, hasOptions: true, error: new Error("Refresh failed") }}
    />,
  );
  expect(screen.getByText(/Showing previously loaded options/)).toBeTruthy();
  const retry = screen.getByRole("button", { name: "Retry loading filters" });
  await fireEvent.press(retry);
  await fireEvent.press(retry);
  expect(refetch).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish();
  });
  expect(
    screen.getByRole("button", { name: "Retry loading filters" }),
  ).toBeEnabled();
});
