import { fireEvent, render } from "@testing-library/react-native";
import { Animated } from "react-native";

import ProfileScrollView from "../ProfileScrollView";

jest.mock("@/shared/hooks/useTabBarSpacing", () => ({
  useTabBarSpacing: () => 20,
}));

describe("Profile scroll threshold animation", () => {
  afterEach(() => jest.restoreAllMocks());

  it("animates only threshold transitions, including fast reversals", async () => {
    const start = jest.fn();
    const animation = { start, stop: jest.fn(), reset: jest.fn() };
    const timing = jest.spyOn(Animated, "timing").mockReturnValue(animation);
    const parallel = jest
      .spyOn(Animated, "parallel")
      .mockReturnValue(animation);
    const screen = await render(
      <ProfileScrollView firstname="Cebu" lastname="Explorer">
        {null}
      </ProfileScrollView>,
    );

    async function scroll(y: number) {
      await fireEvent.scroll(screen.getByTestId("profile-scroll-view"), {
        nativeEvent: { contentOffset: { y } },
      });
    }

    for (const y of [0, 40, 120, 90]) await scroll(y);
    expect(timing).not.toHaveBeenCalled();
    await scroll(121);
    expect(timing).toHaveBeenCalledTimes(2);
    expect(timing.mock.calls.map(([, config]) => config)).toEqual([
      { toValue: 1, duration: 100, useNativeDriver: true },
      { toValue: 0, duration: 100, useNativeDriver: true },
    ]);
    for (const y of [150, 300, 122]) await scroll(y);
    expect(timing).toHaveBeenCalledTimes(2);
    await scroll(120);
    expect(timing).toHaveBeenCalledTimes(4);
    expect(
      timing.mock.calls.slice(2).map(([, config]) => config.toValue),
    ).toEqual([0, -20]);
    await scroll(121);
    await scroll(119);
    await scroll(80);
    expect(timing).toHaveBeenCalledTimes(8);
    expect(parallel).toHaveBeenCalledTimes(4);
    expect(start).toHaveBeenCalledTimes(4);
    expect(screen.getByText("Cebu Explorer")).toBeTruthy();
  });
});
