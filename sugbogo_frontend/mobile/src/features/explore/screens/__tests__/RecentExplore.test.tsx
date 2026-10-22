import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import * as Native from "react-native";
import { router } from "expo-router";
import useRecentExplore from "../../hooks/useRecentExplore";
import RecentExploreScreen from "../RecentExploreScreen";
import RecentExploreBusinessScreen from "../RecentExploreBusinessScreen";
import useOfflineBusinessSnapshots from "@/features/offline-pockets/hooks/useOfflineBusinessSnapshots";
import {
  recentBusinessDetails,
  projectRecentBusinessDetail,
} from "../../services/recentBusinessDetails.service";
import {
  businessFixture,
  snapshotFixture,
} from "@/features/offline-pockets/validation/__tests__/snapshotFixture";
import { useOfflineAccessStore } from "@/features/offline-routes/stores/offlineAccess.store";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { suspendAuthSession } from "@/shared/api/authSessionGeneration.service";

jest.mock("../../hooks/useRecentExplore", () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock(
  "@/features/offline-pockets/hooks/useOfflineBusinessSnapshots",
  () => ({ __esModule: true, default: jest.fn() }),
);
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual(
    "@react-native-async-storage/async-storage/jest/async-storage-mock",
  ),
);
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));
jest.mock(
  "@/shared/components/AppText",
  () => jest.requireActual("react-native").Text,
);
jest.mock(
  "@/shared/components/SafePressable",
  () => jest.requireActual("react-native").Pressable,
);
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("@/shared/components/SpecialtyTagChip", () => {
  const { Text } = jest.requireActual("react-native");
  return function MockChip({ tag }: { tag: { name: string } }) {
    return <Text>{tag.name}</Text>;
  };
});
jest.mock("expo-image", () => {
  const { View } = jest.requireActual("react-native");
  return {
    Image: function MockImage({ onError }: { onError: () => void }) {
      return <View testID="remote-cover" onError={onError} />;
    },
  };
});
// Any accidental live-subtree mounting must fail, instead of merely hiding controls.
jest.mock("../LiveBusinessProfile", () => {
  throw new Error("Live profile imported by local-only route");
});
jest.mock("../../hooks/useBusinessProfileVisit", () => {
  throw new Error("Analytics imported by local-only route");
});
jest.mock("../../hooks/useBusinessReviews", () => {
  throw new Error("Reviews imported by local-only route");
});

let client: QueryClient;
const fetchedAt = Date.parse("2026-10-22T01:00:00Z");
const keys = [
  "explore-discovery",
  "explore-new-businesses",
  "explore-recommendations",
];
const titles = ["Hidden Gems", "New to SugboGo", "Based on your interests"];
function state() {
  return {
    grant: useOfflineAccessStore.getState().recentExplore,
    feeds: keys.map((key, index) => ({
      key,
      title: titles[index],
      fetchedAt,
      expiresAt: fetchedAt + 86_400_000,
      items: [
        {
          ...businessFixture(index + 1),
          business_name: `Local place ${index + 1}`,
          is_pocketed: false,
        },
      ],
    })),
    isPending: false,
  };
}

beforeEach(() => {
  onlineManager.setOnline(false);
  const generation = suspendAuthSession();
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: false,
  });
  useOfflineAccessStore.setState({
    ownerId: null,
    isRevoking: false,
    recentExplore: {
      ownerId: 7,
      apiScope: process.env.EXPO_PUBLIC_API_URL ?? "",
      generation,
    },
  });
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  jest.mocked(useRecentExplore).mockReturnValue(state() as never);
  jest.mocked(useOfflineBusinessSnapshots).mockReturnValue({
    ownerId: null,
    isFetching: false,
    refetch: jest.fn(),
  } as never);
  jest.spyOn(recentBusinessDetails, "readLocal").mockResolvedValue(null);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(async () => {
  await client.cancelQueries();
  client.clear();
  onlineManager.setOnline(true);
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

it.each([320, 390, 430])(
  "renders all three local sections with one status and no Pocket actions at width %s",
  async (width) => {
    jest.spyOn(Native, "useWindowDimensions").mockReturnValue({
      width,
      height: 760,
      scale: 1,
      fontScale: width === 320 ? 1.5 : 1,
    });
    const view = await render(<RecentExploreScreen />);
    for (const title of titles) expect(view.getByText(title)).toBeTruthy();
    expect(view.getAllByText("Showing previously loaded content")).toHaveLength(
      1,
    );
    expect(
      view.getByText(`Updated ${new Date(fetchedAt).toLocaleString()}`),
    ).toBeTruthy();
    expect(view.queryByRole("button", { name: /Pocket/i })).toBeNull();
    await fireEvent.press(
      view.getByRole("button", { name: "Open Local place 1 business profile" }),
    );
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/recent-explore/[businessId]",
      params: { businessId: "1" },
    });
  },
);

it("omits missing sections and preserves long names when a cover fails", async () => {
  const local = state();
  local.feeds = local.feeds.slice(0, 1);
  local.feeds[0].items[0].business_name =
    "A long local business name that remains readable on a small device";
  local.feeds[0].items[0].display_cover_photo_url =
    "https://example.test/cover.jpg";
  jest.mocked(useRecentExplore).mockReturnValue(local as never);
  const view = await render(<RecentExploreScreen />);
  expect(view.queryByText(titles[1])).toBeNull();
  expect(view.queryByText(titles[2])).toBeNull();
  await fireEvent(view.getByTestId("remote-cover"), "error");
  expect(view.queryByTestId("remote-cover")).toBeNull();
  expect(view.getByText(local.feeds[0].items[0].business_name)).toBeTruthy();
});

it("provides intentional empty navigation without granting authentication", async () => {
  jest
    .mocked(useRecentExplore)
    .mockReturnValue({ grant: null, feeds: [], isPending: false } as never);
  const view = await render(<RecentExploreScreen />);
  expect(view.getByText("Recent Explore unavailable")).toBeTruthy();
  await fireEvent.press(view.getByRole("button", { name: "Sign in" }));
  expect(router.replace).toHaveBeenCalledWith("/(auth)/login");
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
});

it.each(["recent", "offline-pocket"])(
  "renders %s details without importing any live profile effects",
  async (source) => {
    const grant = useOfflineAccessStore.getState().recentExplore!;
    jest
      .mocked(recentBusinessDetails.readLocal)
      .mockResolvedValue(
        projectRecentBusinessDetail(businessFixture(), Date.now()),
      );
    if (source === "offline-pocket") {
      jest.mocked(useOfflineBusinessSnapshots).mockReturnValue({
        ownerId: 7,
        data: {
          context: {
            apiScope: grant.apiScope,
            sessionGeneration: grant.generation,
          },
          entries: [{ status: "available", snapshot: snapshotFixture() }],
          covers: {},
        },
      } as never);
    }
    const view = await render(
      <QueryClientProvider client={client}>
        <RecentExploreBusinessScreen businessId={21} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(view.getByText("Sugbo Cafe")).toBeTruthy());
    expect(
      view.getByText(
        source === "recent"
          ? /Showing previously loaded information/
          : /Device copy/,
      ),
    ).toBeTruthy();
    expect(view.queryByText(/Open now/i)).toBeNull();
    expect(
      view.queryByRole("button", { name: /review|vouch|Pocket/i }),
    ).toBeNull();
  },
);

it("shows unavailable when neither detail source is readable", async () => {
  const view = await render(
    <QueryClientProvider client={client}>
      <RecentExploreBusinessScreen businessId={21} />
    </QueryClientProvider>,
  );
  await waitFor(() =>
    expect(view.getByText("Business unavailable offline")).toBeTruthy(),
  );
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
});

it("stops displaying detail after the local grant is revoked", async () => {
  jest
    .mocked(recentBusinessDetails.readLocal)
    .mockResolvedValue(
      projectRecentBusinessDetail(businessFixture(), Date.now()),
    );
  const view = await render(
    <QueryClientProvider client={client}>
      <RecentExploreBusinessScreen businessId={21} />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(view.getByText("Sugbo Cafe")).toBeTruthy());
  await act(async () => {
    useOfflineAccessStore.getState().setRecentExplore(null);
    jest
      .mocked(useRecentExplore)
      .mockReturnValue({ grant: null, feeds: [], isPending: false } as never);
  });
  await view.rerender(
    <QueryClientProvider client={client}>
      <RecentExploreBusinessScreen businessId={21} />
    </QueryClientProvider>,
  );
  expect(view.queryByText("Sugbo Cafe")).toBeNull();
});
