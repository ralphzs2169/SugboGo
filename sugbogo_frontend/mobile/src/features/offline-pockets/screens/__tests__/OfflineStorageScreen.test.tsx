import { act, fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import Toast from "react-native-toast-message";

import { useAuthStore } from "@/features/auth/store/auth.store";
import useSavedJourneys from "@/features/offline-routes/hooks/useSavedJourneys";
import {
  beginAuthSession,
  getAuthSessionGeneration,
  invalidateAuthSession,
} from "@/shared/api/authSessionGeneration.service";
import useOfflineStorageSummary from "../../hooks/useOfflineStorageSummary";
import {
  clearOfflineBusinessData,
  cleanupOfflinePocketCoverFiles,
} from "../../services/offlinePockets.service";
import { retryOfflineBusinessDownloads } from "../../services/offlineStorageActions.service";
import OfflineStorageScreen from "../OfflineStorageScreen";

let mockOnline = true;
jest.mock("../../hooks/useOfflineStorageSummary");
jest.mock("@/features/offline-routes/hooks/useSavedJourneys");
jest.mock("@react-native-community/netinfo", () => ({
  useNetInfo: () => ({
    isConnected: mockOnline,
    isInternetReachable: mockOnline,
  }),
}));
jest.mock("../../services/offlinePockets.service", () => ({
  clearOfflineBusinessData: jest.fn(),
  cleanupOfflinePocketCoverFiles: jest.fn(),
  currentOfflineBusinessOwner: () =>
    jest
      .requireActual("@/features/auth/store/auth.store")
      .useAuthStore.getState().user?.id ?? null,
}));
jest.mock("../../services/offlineStorageActions.service", () => ({
  retryOfflineBusinessDownloads: jest.fn(),
}));
jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => false,
  },
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("@/shared/components/modals/ConfirmModal", () => {
  const { View, Pressable, Text } = jest.requireActual("react-native");
  return function Confirm({
    visible,
    message,
    onConfirm,
    onCancel,
  }: {
    visible: boolean;
    message: React.ReactNode;
    onConfirm: () => void;
    onCancel: () => void;
  }) {
    return visible ? (
      <View>
        {message}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Confirm clear"
          onPress={onConfirm}
        >
          <Text>Confirm clear</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel clear"
          onPress={onCancel}
        >
          <Text>Cancel</Text>
        </Pressable>
      </View>
    ) : null;
  };
});

const refetch = jest.fn();
const reloadJourneys = jest.fn();
function summary(overrides = {}) {
  const context = {
    apiScope: "api",
    ownerId: 7,
    sessionGeneration: getAuthSessionGeneration(),
    clearGeneration: 0,
    access: "authenticated" as const,
  };
  return {
    ownerId: 7,
    isPending: false,
    isError: false,
    refetch,
    data: {
      context,
      businessCount: 12,
      storageBytes: 2 * 1024 * 1024,
      lastUpdated: Date.parse("2026-10-22T01:00:00Z"),
      hasBusinessData: true,
      cleanupPending: false,
      retries: [],
      ...overrides,
    },
  };
}

describe("Offline Storage management", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnline = true;
    beginAuthSession();
    useAuthStore.setState({
      user: { id: 7 } as never,
      isAuthenticated: true,
      isLoading: false,
    });
    jest.mocked(useOfflineStorageSummary).mockReturnValue(summary() as never);
    jest.mocked(useSavedJourneys).mockReturnValue({
      ownerId: 7,
      items: [{ snapshot: {} }, { snapshot: {} }, { snapshot: null }],
      isLoading: false,
      error: null,
      reload: reloadJourneys,
    } as never);
    jest
      .mocked(clearOfflineBusinessData)
      .mockImplementation(async (context) => ({
        context: { ...context, clearGeneration: 1 },
        cleanupPending: false,
      }));
    jest.mocked(cleanupOfflinePocketCoverFiles).mockResolvedValue(undefined);
    jest.mocked(retryOfflineBusinessDownloads).mockResolvedValue(1);
  });

  it("renders validated counts, a scoped size estimate and both local navigation entries", async () => {
    const view = await render(<OfflineStorageScreen />);
    expect(view.getByText("12")).toBeTruthy();
    expect(view.getByText("2")).toBeTruthy();
    expect(view.getByText("About 2.0 MB")).toBeTruthy();
    expect(view.getByText("Last updated")).toBeTruthy();
    await fireEvent.press(
      view.getByRole("button", { name: "Saved businesses" }),
    );
    expect(router.push).toHaveBeenCalledWith("/offline-pockets");
    await fireEvent.press(view.getByRole("button", { name: "Saved journeys" }));
    expect(router.push).toHaveBeenCalledWith("/offline-routes");
  });

  it("requires clear confirmation, explains scope, and updates to the empty state", async () => {
    jest
      .mocked(clearOfflineBusinessData)
      .mockImplementationOnce(async (context) => {
        jest.mocked(useOfflineStorageSummary).mockReturnValue(
          summary({
            businessCount: 0,
            storageBytes: 0,
            lastUpdated: null,
            hasBusinessData: false,
          }) as never,
        );
        return {
          context: { ...context, clearGeneration: 1 },
          cleanupPending: false,
        };
      });
    const view = await render(<OfflineStorageScreen />);
    await fireEvent.press(
      view.getByRole("button", { name: "Clear offline business data" }),
    );
    expect(view.getByText(/Businesses stay saved in My Pockets/)).toBeTruthy();
    expect(view.getByText(/Saved journeys are unaffected/)).toBeTruthy();
    expect(clearOfflineBusinessData).not.toHaveBeenCalled();
    await fireEvent.press(view.getByRole("button", { name: "Cancel clear" }));
    expect(clearOfflineBusinessData).not.toHaveBeenCalled();
    await fireEvent.press(
      view.getByRole("button", { name: "Clear offline business data" }),
    );
    await act(async () =>
      fireEvent.press(view.getByRole("button", { name: "Confirm clear" })),
    );
    expect(clearOfflineBusinessData).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 7, clearGeneration: 0 }),
    );
    expect(view.getByText("No businesses available offline")).toBeTruthy();
    expect(view.getByText("2")).toBeTruthy();
  });

  it("keeps local browsing and clearing usable offline while online-only actions are disabled", async () => {
    mockOnline = false;
    const view = await render(<OfflineStorageScreen />);
    expect(
      view.getByRole("button", { name: "View My Pockets" }).props
        .accessibilityState.disabled,
    ).toBe(true);
    await fireEvent.press(
      view.getByRole("button", { name: "Saved businesses" }),
    );
    await fireEvent.press(
      view.getByRole("button", { name: "Clear offline business data" }),
    );
    await act(async () =>
      fireEvent.press(view.getByRole("button", { name: "Confirm clear" })),
    );
    expect(clearOfflineBusinessData).toHaveBeenCalledTimes(1);
  });

  it("retains clear failures in the confirmation and reports partial physical cleanup", async () => {
    jest
      .mocked(clearOfflineBusinessData)
      .mockRejectedValueOnce(new Error("SQL details must not be shown"));
    const view = await render(<OfflineStorageScreen />);
    await fireEvent.press(
      view.getByRole("button", { name: "Clear offline business data" }),
    );
    await act(async () =>
      fireEvent.press(view.getByRole("button", { name: "Confirm clear" })),
    );
    expect(view.getByRole("alert")).toBeTruthy();
    expect(view.queryByText(/SQL details/)).toBeNull();
    jest.mocked(clearOfflineBusinessData).mockResolvedValueOnce({
      context: summary().data.context,
      cleanupPending: true,
    });
    await act(async () =>
      fireEvent.press(view.getByRole("button", { name: "Confirm clear" })),
    );
    await act(async () =>
      fireEvent.press(
        view.getByRole("button", { name: "Finish removing photos" }),
      ),
    );
    expect(cleanupOfflinePocketCoverFiles).toHaveBeenCalled();
  });

  it("provides independent business and journey error recovery without hiding navigation", async () => {
    jest.mocked(useOfflineStorageSummary).mockReturnValue({
      ...summary(),
      isError: true,
      data: undefined,
    } as never);
    jest.mocked(useSavedJourneys).mockReturnValue({
      ownerId: 7,
      items: [],
      isLoading: false,
      error: new Error("unavailable"),
      reload: reloadJourneys,
    } as never);
    const view = await render(<OfflineStorageScreen />);
    await fireEvent.press(
      view.getByRole("button", { name: /retry business storage/i }),
    );
    expect(refetch).toHaveBeenCalled();
    expect(reloadJourneys).not.toHaveBeenCalled();
    await fireEvent.press(
      view.getByRole("button", { name: /retry journeys/i }),
    );
    expect(reloadJourneys).toHaveBeenCalled();
    expect(view.getByRole("button", { name: "Saved businesses" })).toBeTruthy();
  });

  it("retries only the supplied eligible revisions and keeps retry failures actionable", async () => {
    const operation = {
      ...summary().data.context,
      businessId: 21,
      operationVersion: 3,
    };
    jest
      .mocked(useOfflineStorageSummary)
      .mockReturnValue(
        summary({ retries: [{ operation, retryAt: 0 }] }) as never,
      );
    jest
      .mocked(retryOfflineBusinessDownloads)
      .mockRejectedValueOnce(new Error("network"));
    const view = await render(<OfflineStorageScreen />);
    await act(async () =>
      fireEvent.press(view.getByRole("button", { name: "Retry downloads" })),
    );
    expect(retryOfflineBusinessDownloads).toHaveBeenCalledWith([operation]);
    expect(view.getByRole("alert")).toBeTruthy();
    await act(async () =>
      fireEvent.press(view.getByRole("button", { name: "Retry downloads" })),
    );
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ text1: "Downloads requested" }),
    );
  });

  it("hides an old confirmation after account switching and ignores a late logout result", async () => {
    let finish!: (
      result: Awaited<ReturnType<typeof clearOfflineBusinessData>>,
    ) => void;
    jest.mocked(clearOfflineBusinessData).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const view = await render(<OfflineStorageScreen />);
    const old = summary().data.context;
    await fireEvent.press(
      view.getByRole("button", { name: "Clear offline business data" }),
    );
    await act(async () =>
      fireEvent.press(view.getByRole("button", { name: "Confirm clear" })),
    );
    invalidateAuthSession();
    jest.mocked(useOfflineStorageSummary).mockReturnValue({
      ownerId: null,
      isPending: true,
      data: undefined,
    } as never);
    await act(async () =>
      useAuthStore.setState({ user: null, isAuthenticated: false }),
    );
    expect(view.queryByRole("button", { name: "Confirm clear" })).toBeNull();
    await act(async () => finish({ context: old, cleanupPending: false }));
    expect(Toast.show).not.toHaveBeenCalled();
  });
});
