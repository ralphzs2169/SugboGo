import { fireEvent, render } from "@testing-library/react-native";

import ExploreScreen from "../ExploreScreen";

const mockPush = jest.fn();

jest.mock("../../api/exploreBusiness.service", () => ({}));

jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
  },
}));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ refetchQueries: jest.fn() }),
}));
jest.mock("@/shared/hooks/useTabBarSpacing", () => ({
  useTabBarSpacing: () => 0,
}));
jest.mock("@/shared/hooks/useUserLocation", () => () => ({
  location: null,
  refreshLocation: jest.fn(async () => undefined),
}));
jest.mock("../../hooks/useBusinessImpressions", () => () => ({
  onViewportLayout: jest.fn(),
  onVerticalScroll: jest.fn(),
}));
jest.mock("../../hooks/useOpenNowBusinesses", () => () => ({
  businesses: [],
  refreshAtLocation: jest.fn(),
}));
jest.mock("../../hooks/useDiscoveryFeed", () => ({
  __esModule: true,
  default: () => ({
    businesses: [],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
  DISCOVERY_FEED_QUERY_KEY: ["discovery-feed"],
}));
jest.mock("../../hooks/useExploreFilterOptions", () => () => ({
  options: { clusters: [] },
}));
jest.mock("../../components/ExploreTopBar", () => () => null);
jest.mock("../../components/hidden-gems/HiddenGemsSection", () => () => null);
jest.mock("../../components/interests/UserInterestsSection", () => ({
  __esModule: true,
  default: ({ onSeeAll }: { onSeeAll: () => void }) => {
    const { Button } = jest.requireActual("react-native");
    return <Button title="Open Interests" onPress={() => onSeeAll()} />;
  },
}));
jest.mock("../../components/new-businesses/NewBusinessesSection", () => ({
  __esModule: true,
  default: ({ onSeeAll }: { onSeeAll: () => void }) => {
    const { Button } = jest.requireActual("react-native");
    return <Button title="Open New" onPress={onSeeAll} />;
  },
}));
jest.mock(
  "../../components/explore-by-specialty/ExploreBySpecialtySection",
  () => () => null,
);
jest.mock(
  "../../components/discovery-shortcuts/DiscoveryShortcutsSection",
  () => () => null,
);

it("opens the reusable screen from the homepage collection actions", async () => {
  const screen = await render(<ExploreScreen />);

  for (const [title, collectionType] of [
    ["Open Interests", "interests"],
    ["Open New", "new-businesses"],
  ]) {
    await fireEvent.press(screen.getByText(title));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: "/(explorer)/explore-collection/[collectionType]",
      params: { collectionType },
    });
  }
});
