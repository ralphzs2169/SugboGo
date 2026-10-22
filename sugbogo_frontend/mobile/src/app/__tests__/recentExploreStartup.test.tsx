import { render, waitFor } from "@testing-library/react-native";
import Index from "../index";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useOfflineAccessStore } from "@/features/offline-routes/stores/offlineAccess.store";
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual(
    "@react-native-async-storage/async-storage/jest/async-storage-mock",
  ),
);
jest.mock("expo-router", () => {
  const { Text } = jest.requireActual("react-native");
  return {
    Redirect: function MockRedirect({ href }: { href: unknown }) {
      return <Text>{JSON.stringify(href)}</Text>;
    },
  };
});
jest.mock("@/shared/api/onboardingStorage.service", () => ({
  hasCompletedOnboarding: async () => true,
}));

it.each([
  [true, true, "/offline-storage"],
  [false, true, "/recent-explore"],
  [true, false, "/offline-storage"],
  [false, false, "/(auth)/login"],
] as const)(
  "routes durable=%s recent=%s to %s",
  async (durable, recent, destination) => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
    useOfflineAccessStore.setState({
      ownerId: durable ? 7 : null,
      recentExplore: recent
        ? { ownerId: 7, apiScope: "", generation: 1 }
        : null,
    });
    const view = await render(<Index />);
    await waitFor(() =>
      expect(view.getByText(JSON.stringify(destination))).toBeTruthy(),
    );
  },
);

it("keeps validated authentication above all local access routes", async () => {
  useAuthStore.setState({
    user: {
      id: 7,
      role: "explorer",
      has_completed_interest_selection: true,
    } as never,
    isAuthenticated: true,
    isLoading: false,
  });
  useOfflineAccessStore.setState({
    ownerId: 7,
    recentExplore: { ownerId: 7, apiScope: "", generation: 1 },
  });
  const view = await render(<Index />);
  await waitFor(() =>
    expect(
      view.getByText(JSON.stringify("/(explorer)/(tabs)/explore")),
    ).toBeTruthy(),
  );
});
