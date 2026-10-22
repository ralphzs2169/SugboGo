import { fireEvent, render } from "@testing-library/react-native";

import NewBusinessesSection from "../new-businesses/NewBusinessesSection";
import ExploreBySpecialtySection from "../explore-by-specialty/ExploreBySpecialtySection";
import DiscoveryShortcutsSection from "../discovery-shortcuts/DiscoveryShortcutsSection";
import ExploreMapSection from "../explore-map/ExploreMapSection";
import useNewBusinesses from "../../hooks/useNewBusinesses";
import useExploreSpecialties from "../../hooks/useExploreSpecialties";
import useDiscoveryShortcuts from "../../hooks/useDiscoveryShortcuts";

jest.mock("../../hooks/useNewBusinesses");
jest.mock("../../hooks/useExploreSpecialties");
jest.mock("../../hooks/useDiscoveryShortcuts");
jest.mock("@/shared/utils/apiErrors", () => ({
  handleSystemError: jest.fn(() => true),
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock(
  "@/shared/components/AppText",
  () => jest.requireActual("react-native").Text,
);
jest.mock(
  "@/shared/components/SafePressable",
  () => jest.requireActual("react-native").Pressable,
);
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("@/shared/components/ErrorState", () => {
  const { Text } = jest.requireActual("react-native");
  return function MockError({
    onPrimaryAction,
  }: {
    onPrimaryAction: () => void;
  }) {
    return <Text onPress={onPrimaryAction}>Retry failed section</Text>;
  };
});
jest.mock("../business-carousel/ExploreBusinessCarouselSection", () => {
  const { Text } = jest.requireActual("react-native");
  return function MockCarousel({
    businesses,
  }: {
    businesses: { business_name: string }[];
  }) {
    return <Text>{businesses[0].business_name}</Text>;
  };
});
jest.mock("@/features/map/components/BusinessDiscoveryMap", () => {
  const { Text } = jest.requireActual("react-native");
  return function MockMap({ businesses }: { businesses: unknown[] }) {
    return <Text>{businesses.length} loaded map places</Text>;
  };
});

const refetch = jest.fn(async () => undefined);
const state = { isLoading: false, error: null, refetch };
const impressions = {} as never;
const props = { impressions, userLocation: null, onBusinessPress: jest.fn() };

const cases = [
  {
    name: "new businesses",
    hook: useNewBusinesses,
    empty: { businesses: [] },
    content: { businesses: [{ id: 1, business_name: "Loaded new business" }] },
    label: "Loaded new business",
    render: () => <NewBusinessesSection {...props} />,
  },
  {
    name: "specialty shortcuts",
    hook: useExploreSpecialties,
    empty: { specialties: [] },
    content: {
      specialties: [
        { id: 1, name: "Loaded specialty", color: "brown", icon: "coffee" },
      ],
    },
    label: "Loaded specialty",
    render: () => <ExploreBySpecialtySection />,
  },
  {
    name: "discovery shortcuts",
    hook: useDiscoveryShortcuts,
    empty: { shortcuts: [] },
    content: {
      shortcuts: [
        {
          id: 1,
          title: "Loaded shortcut",
          subtitle: "Explore",
          cluster: { id: 1, icon: "utensils" },
        },
      ],
    },
    label: "Loaded shortcut",
    render: () => <DiscoveryShortcutsSection />,
  },
];

it.each(cases)("preserves $name when refresh fails", async (test) => {
  (test.hook as jest.Mock).mockReturnValue({ ...state, ...test.content });
  const screen = await render(test.render());
  (test.hook as jest.Mock).mockReturnValue({
    ...state,
    ...test.content,
    error: new Error("Offline"),
  });
  await screen.rerender(test.render());
  expect(screen.getByText(test.label)).toBeTruthy();
  expect(screen.queryByText("Retry failed section")).toBeNull();
});

it.each(cases)("retains initial error recovery for $name", async (test) => {
  (test.hook as jest.Mock).mockReturnValue({
    ...state,
    ...test.empty,
    error: new Error("Offline"),
  });
  const screen = await render(test.render());
  await fireEvent.press(screen.getByText("Retry failed section"));
  expect(refetch).toHaveBeenCalledTimes(1);
});

it.each(cases)(
  "shows retry instead of a false empty state when $name pauses offline",
  async (test) => {
    (test.hook as jest.Mock).mockReturnValue({
      ...state,
      ...test.empty,
      isPaused: true,
    });
    const screen = await render(test.render());
    expect(screen.getByText("Retry failed section")).toBeTruthy();
  },
);

it("keeps the loaded map preview after refresh failure, but offers retry without places", async () => {
  const mapProps = {
    ...state,
    userLocation: null,
    onOpenMap: jest.fn(),
    businesses: [{ id: 1 }] as never,
  };
  const screen = await render(<ExploreMapSection {...mapProps} />);
  await screen.rerender(
    <ExploreMapSection {...mapProps} error={new Error("Offline")} />,
  );
  expect(screen.getByText("1 loaded map places")).toBeTruthy();
  expect(screen.queryByText("Retry failed section")).toBeNull();
  await screen.rerender(
    <ExploreMapSection
      {...mapProps}
      businesses={[]}
      error={new Error("Offline")}
    />,
  );
  await fireEvent.press(screen.getByText("Retry failed section"));
  expect(refetch).toHaveBeenCalledTimes(1);
});
