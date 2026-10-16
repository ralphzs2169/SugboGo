import { render } from "@testing-library/react-native";

import TabLayout from "../_layout";

jest.mock("@/shared/components/CustomTabBar", () => () => null);

jest.mock("expo-router", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");

  function MockTabs({ children }: { children: React.ReactNode }) {
    return React.createElement(View, null, children);
  }

  function MockTabScreen({ name }: { name: string }) {
    return React.createElement(View, { testID: `explorer-tab-${name}` });
  }

  MockTabs.Screen = MockTabScreen;

  return { Tabs: MockTabs };
});

describe("Explorer tab layout", () => {
  it("does not register Notifications as a visible tab destination", async () => {
    const screen = await render(<TabLayout />);

    expect(screen.getByTestId("explorer-tab-explore")).toBeTruthy();
    expect(screen.getByTestId("explorer-tab-profile")).toBeTruthy();
    expect(screen.queryByTestId("explorer-tab-notifications")).toBeNull();
  });
});
