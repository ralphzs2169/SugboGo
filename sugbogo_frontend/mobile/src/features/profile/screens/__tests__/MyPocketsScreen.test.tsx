import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
import { router } from "expo-router";
import type { PropsWithChildren } from "react";

import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  getPocketCollections,
  createPocketCollection,
  renamePocketCollection,
  deletePocketCollection,
} from "@/features/pockets/api/pockets.service";
import { pocketCollectionsQueryKey } from "@/features/pockets/hooks/pocketQueryKeys";
import type {
  PocketCollection,
  PocketCollectionListResponse,
} from "@/features/pockets/types/pockets.types";
import type { User } from "@/features/users/types/user.types";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import type {
  ApiError,
  ApiResponse,
  ApiSuccessWithData,
} from "@/shared/types/apiResponse.types";

import MyPocketsScreen from "../MyPocketsScreen";

jest.mock("@/features/pockets/api/pockets.service", () => ({
  getPocketCollections: jest.fn(),
  createPocketCollection: jest.fn(),
  renamePocketCollection: jest.fn(),
  deletePocketCollection: jest.fn(),
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("@/shared/utils/presentBottomSheet.utils", () => ({
  presentBottomSheet: jest.fn(),
}));
jest.mock("@/shared/components/bottom-sheets/ActionBottomSheet", () => {
  const { View, Text, Pressable } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return function Menu(
    props: Parameters<
      typeof import("@/shared/components/bottom-sheets/ActionBottomSheet").default
    >[0],
  ) {
    return (
      <View>
        {props.options.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            onPress={() => {
              props.onSelect(option.value);
              props.onDismiss?.();
            }}
          >
            <Text>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    );
  };
});
jest.mock("@/shared/components/modals/ConfirmModal", () => {
  const { View, Text, Pressable } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return function Confirmation(
    props: Parameters<
      typeof import("@/shared/components/modals/ConfirmModal").default
    >[0],
  ) {
    if (!props.visible) return null;
    return (
      <View>
        <Text>{props.title}</Text>
        {props.message}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Confirm deletion"
          disabled={props.isLoading}
          onPress={props.onConfirm}
        >
          <Text>{props.confirmText}</Text>
        </Pressable>
      </View>
    );
  };
});
jest.mock("@/shared/hooks/useQueryErrorNotification", () => jest.fn());
jest.mock("@/shared/components/Skeleton", () => () => null);
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("lottie-react-native", () => () => null);
jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useNavigation: () => ({ isFocused: () => true }),
  Stack: { Screen: () => null },
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }),
}));

type Screen = Awaited<ReturnType<typeof render>>;
type Response = ApiResponse<PocketCollectionListResponse>;
const initialAuthState = useAuthStore.getState();
const apiError: ApiError = {
  success: false,
  code: "NETWORK_ERROR",
  message: "Offline",
};

function collection(
  id: number,
  name: string,
  count = 2,
  isDefault = false,
): PocketCollection {
  return {
    id,
    name,
    business_count: count,
    is_default: isDefault,
    created_at: "2026-10-19T02:00:00Z",
    updated_at: "2026-10-19T02:00:00Z",
  };
}

const favorites = collection(20, "Favorites", 0, true);
const weekend = collection(10, "Weekend food trips");
const coffee = collection(30, "Coffee spots", 1);
const beach = collection(40, "Beach stops");
const mountains = collection(50, "Mountain trips");

function user(id: number): User {
  return {
    id,
    first_name: "Pocket",
    last_name: "Explorer",
    gender: null,
    email: `pocket-${id}@example.com`,
    role: "explorer",
    status: "active",
    has_completed_interest_selection: true,
    has_custom_profile_picture: false,
    has_oauth_accounts: false,
  };
}

function page(
  items = [favorites, weekend],
  pageNumber = 1,
  hasNext = false,
  totalCount = items.length,
): ApiSuccessWithData<PocketCollectionListResponse> {
  const pageSize = Math.max(items.length, 2);
  return {
    success: true,
    message: "Success.",
    data: {
      items,
      pagination: {
        page: pageNumber,
        page_size: pageSize,
        total_items: totalCount,
        total_pages: Math.ceil(totalCount / pageSize),
        has_next: hasNext,
        has_previous: pageNumber > 1,
      },
    },
  };
}

function pendingResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("MyPocketsScreen", () => {
  let client: QueryClient;

  beforeEach(() => {
    jest.mocked(getPocketCollections).mockReset().mockResolvedValue(page());
    jest.mocked(createPocketCollection).mockReset();
    jest.mocked(renamePocketCollection).mockReset();
    jest.mocked(deletePocketCollection).mockReset();
    useAuthStore.setState({
      user: user(1),
      isAuthenticated: true,
      isLoading: false,
    });
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { gcTime: Infinity },
      },
    });
  });

  afterEach(async () => {
    await cleanup();
    client.clear();
    useAuthStore.setState(initialAuthState);
  });

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  async function loadedOverview() {
    const screen = await render(<MyPocketsScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText("Favorites")).toBeTruthy());
    return screen;
  }

  async function refresh(screen: Screen) {
    await act(async () => {
      screen
        .getByTestId("my-pockets-list")
        .props.refreshControl.props.onRefresh();
    });
  }

  async function scrollToEnd(screen: Screen) {
    await fireEvent(screen.getByTestId("my-pockets-list"), "scrollBeginDrag");
    await fireEvent(screen.getByTestId("my-pockets-list"), "endReached");
  }

  it("floats one accessible Create Pocket action and reserves space for its measured height", async () => {
    const screen = await loadedOverview();
    expect(
      screen.getAllByRole("button", { name: "Create Pocket" }),
    ).toHaveLength(1);
    expect(screen.getByTestId("create-pocket-fab").props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ bottom: 40 })]),
    );
    await fireEvent(screen.getByTestId("create-pocket-fab"), "layout", {
      nativeEvent: { layout: { height: 100, width: 240, x: 0, y: 0 } },
    });
    expect(
      screen.getByTestId("my-pockets-list").props.contentContainerStyle
        .paddingBottom,
    ).toBe(172);
    await fireEvent.press(
      screen.getByRole("button", { name: "Create Pocket" }),
    );
    expect(screen.getByLabelText("Pocket name")).toBeTruthy();
    expect(createPocketCollection).not.toHaveBeenCalled();
  });

  // Allow the first native list mount to complete on a cold Jest run.
  it("keeps the initial skeleton until real collections arrive", async () => {
    const response = pendingResponse();
    jest.mocked(getPocketCollections).mockReturnValueOnce(response.promise);
    const screen = await render(<MyPocketsScreen />, { wrapper: Wrapper });

    expect(screen.getByTestId("pocket-collections-skeleton")).toBeTruthy();
    expect(screen.queryByTestId("my-pockets-empty")).toBeNull();
    await act(async () => {
      response.resolve(page());
    });

    await waitFor(() => expect(screen.getByText("Favorites")).toBeTruthy());
    expect(screen.getByText("Weekend food trips")).toBeTruthy();
    expect(screen.getByText("0 businesses")).toBeTruthy();
    expect(screen.getByText("Default")).toBeTruthy();
    expect(screen.queryByTestId("pocket-collections-skeleton")).toBeNull();
  }, 15000);

  it("preserves backend order and opens each Pocket without prototype management controls", async () => {
    jest
      .mocked(getPocketCollections)
      .mockResolvedValueOnce(page([favorites, coffee, weekend]));
    const screen = await loadedOverview();

    expect(
      screen
        .getAllByText(/^(Favorites|Coffee spots|Weekend food trips)$/)
        .map((node) => node.props.children),
    ).toEqual(["Favorites", "Coffee spots", "Weekend food trips"]);
    expect(screen.queryByPlaceholderText("Search saved MSMEs...")).toBeNull();
    expect(screen.queryByText(/^(Edit|Done|Delete|All)$/)).toBeNull();
    expect(
      screen.getAllByRole("button", { name: /^Open .* Pocket$/ }),
    ).toHaveLength(3);
    await fireEvent.press(
      screen.getByRole("button", { name: "Open Favorites Pocket" }),
    );
    expect(router.push).toHaveBeenLastCalledWith(
      "/(explorer)/profile/pockets/20",
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Open Coffee spots Pocket" }),
    );
    expect(router.push).toHaveBeenLastCalledWith(
      "/(explorer)/profile/pockets/30",
    );
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("shows a successful empty response without synthesizing Favorites", async () => {
    jest.mocked(getPocketCollections).mockResolvedValueOnce(page([]));
    const screen = await render(<MyPocketsScreen />, { wrapper: Wrapper });

    await waitFor(() =>
      expect(screen.getByTestId("my-pockets-empty")).toBeTruthy(),
    );
    expect(screen.queryByText("Favorites")).toBeNull();
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
    expect(screen.queryByTestId("my-pockets-page-loader")).toBeNull();
  });

  it("keeps initial errors distinct from empty results and retries page one", async () => {
    jest
      .mocked(getPocketCollections)
      .mockResolvedValueOnce(apiError)
      .mockResolvedValueOnce(page());
    const screen = await render(<MyPocketsScreen />, { wrapper: Wrapper });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy(),
    );
    expect(screen.queryByTestId("my-pockets-empty")).toBeNull();
    expect(screen.queryByText("Favorites")).toBeNull();
    expect(useQueryErrorNotification).toHaveBeenCalledWith(
      expect.objectContaining({ error: apiError }),
    );
    await fireEvent.press(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => expect(screen.getByText("Favorites")).toBeTruthy());
    expect(getPocketCollections).toHaveBeenNthCalledWith(1, 1);
    expect(getPocketCollections).toHaveBeenNthCalledWith(2, 1);
  });

  it("refreshes in place, guards repeated refreshes, and adopts authoritative counts", async () => {
    const screen = await loadedOverview();
    const response = pendingResponse();
    jest.mocked(getPocketCollections).mockReturnValueOnce(response.promise);
    await act(async () => {
      const onRefresh =
        screen.getByTestId("my-pockets-list").props.refreshControl.props
          .onRefresh;
      onRefresh();
      onRefresh();
    });

    await waitFor(() => expect(getPocketCollections).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Favorites")).toBeTruthy();
    expect(screen.queryByTestId("pocket-collections-skeleton")).toBeNull();
    await waitFor(() =>
      expect(
        screen.getByTestId("my-pockets-list").props.refreshControl.props
          .refreshing,
      ).toBe(true),
    );
    expect(screen.queryByTestId("my-pockets-page-loader")).toBeNull();
    await act(async () => {
      response.resolve(page([{ ...favorites, business_count: 1 }, weekend]));
    });

    await waitFor(() => expect(screen.getByText("1 business")).toBeTruthy());
    expect(
      screen.getByTestId("my-pockets-list").props.refreshControl.props
        .refreshing,
    ).toBe(false);
  });

  it("preserves loaded collections after refresh failure and retries the refresh", async () => {
    const screen = await loadedOverview();
    jest
      .mocked(getPocketCollections)
      .mockResolvedValueOnce(apiError)
      .mockResolvedValueOnce(page());
    await refresh(screen);

    await waitFor(() =>
      expect(screen.getByText("Unable to refresh your Pockets")).toBeTruthy(),
    );
    expect(screen.getByText("Favorites")).toBeTruthy();
    expect(screen.getByText("Weekend food trips")).toBeTruthy();
    expect(screen.queryByTestId("my-pockets-empty")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() =>
      expect(screen.queryByText("Unable to refresh your Pockets")).toBeNull(),
    );
    expect(getPocketCollections).toHaveBeenCalledTimes(3);
    expect(getPocketCollections).toHaveBeenLastCalledWith(1);
  });

  it("offers recovery when refreshing a previously empty list fails", async () => {
    jest
      .mocked(getPocketCollections)
      .mockResolvedValueOnce(page([]))
      .mockResolvedValueOnce(apiError)
      .mockResolvedValueOnce(page([]));
    const screen = await render(<MyPocketsScreen />, { wrapper: Wrapper });
    await waitFor(() =>
      expect(screen.getByTestId("my-pockets-empty")).toBeTruthy(),
    );
    await refresh(screen);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy(),
    );
    expect(screen.queryByTestId("my-pockets-empty")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() =>
      expect(screen.getByTestId("my-pockets-empty")).toBeTruthy(),
    );
  });

  it("keeps loaded rows during pagination, explicitly retries the failed page, and stops at the end", async () => {
    const response = pendingResponse();
    jest
      .mocked(getPocketCollections)
      .mockResolvedValueOnce(page([favorites, weekend], 1, true, 3))
      .mockReturnValueOnce(response.promise)
      .mockResolvedValueOnce(page([coffee], 2, false, 3));
    const screen = await loadedOverview();
    await fireEvent(screen.getByTestId("my-pockets-list"), "endReached");
    expect(getPocketCollections).toHaveBeenCalledTimes(1);
    await fireEvent(screen.getByTestId("my-pockets-list"), "scrollBeginDrag");
    await act(async () => {
      const onEndReached =
        screen.getByTestId("my-pockets-list").props.onEndReached;
      onEndReached();
      onEndReached();
    });

    await waitFor(() =>
      expect(screen.getByTestId("my-pockets-page-loader")).toBeTruthy(),
    );
    expect(getPocketCollections).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Favorites")).toBeTruthy();
    expect(screen.queryByTestId("pocket-collections-skeleton")).toBeNull();
    expect(
      screen.getByTestId("my-pockets-list").props.refreshControl.props
        .refreshing,
    ).toBe(false);
    await act(async () => {
      response.resolve(apiError);
    });

    await waitFor(() =>
      expect(screen.getByText("Unable to load more Pockets")).toBeTruthy(),
    );
    expect(screen.getByText("Favorites")).toBeTruthy();
    await scrollToEnd(screen);
    expect(getPocketCollections).toHaveBeenCalledTimes(2);
    await fireEvent.press(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => expect(screen.getByText("Coffee spots")).toBeTruthy());
    expect(getPocketCollections).toHaveBeenNthCalledWith(2, 2);
    expect(getPocketCollections).toHaveBeenNthCalledWith(3, 2);
    expect(screen.getByText("You've seen all your Pockets.")).toBeTruthy();
    await scrollToEnd(screen);
    expect(getPocketCollections).toHaveBeenCalledTimes(3);
  });

  it("requires a new scroll before fetching another page after the previous page settles", async () => {
    jest
      .mocked(getPocketCollections)
      .mockResolvedValueOnce(page([favorites, weekend], 1, true, 5))
      .mockResolvedValueOnce(page([coffee, beach], 2, true, 5))
      .mockResolvedValueOnce(page([mountains], 3, false, 5));
    const screen = await loadedOverview();
    await scrollToEnd(screen);
    await waitFor(() => expect(screen.getByText("Coffee spots")).toBeTruthy());
    await fireEvent(screen.getByTestId("my-pockets-list"), "endReached");
    expect(getPocketCollections).toHaveBeenCalledTimes(2);
    await scrollToEnd(screen);

    await waitFor(() =>
      expect(screen.getByText("Mountain trips")).toBeTruthy(),
    );
    expect(getPocketCollections).toHaveBeenCalledTimes(3);
    expect(getPocketCollections).toHaveBeenLastCalledWith(3);
  });

  it("waits for authentication restoration without showing empty content or making requests", async () => {
    useAuthStore.setState({ isLoading: true });
    const screen = await render(<MyPocketsScreen />, { wrapper: Wrapper });

    expect(screen.getByTestId("pocket-collections-skeleton")).toBeTruthy();
    expect(screen.queryByTestId("my-pockets-empty")).toBeNull();
    await refresh(screen);
    await scrollToEnd(screen);
    expect(getPocketCollections).not.toHaveBeenCalled();
    await act(async () => {
      useAuthStore.getState().setLoading(false);
    });

    await waitFor(() => expect(screen.getByText("Favorites")).toBeTruthy());
    expect(getPocketCollections).toHaveBeenCalledTimes(1);
  });

  it("hides the previous account, ignores its late response, and hides cached rows on sign-out", async () => {
    const oldRefresh = pendingResponse();
    const nextOwner = pendingResponse();
    const ownerOne = collection(11, "Owner one trips");
    const ownerTwo = collection(21, "Owner two trips");
    jest
      .mocked(getPocketCollections)
      .mockResolvedValueOnce(page([favorites, ownerOne]))
      .mockReturnValueOnce(oldRefresh.promise)
      .mockReturnValueOnce(nextOwner.promise);
    const screen = await loadedOverview();
    await refresh(screen);
    await waitFor(() => expect(getPocketCollections).toHaveBeenCalledTimes(2));
    await act(async () => {
      useAuthStore.getState().setUser(user(2));
    });

    await waitFor(() => expect(getPocketCollections).toHaveBeenCalledTimes(3));
    expect(screen.queryByText("Owner one trips")).toBeNull();
    expect(screen.getByTestId("pocket-collections-skeleton")).toBeTruthy();
    await act(async () => {
      nextOwner.resolve(page([collection(22, "Favorites", 4, true), ownerTwo]));
    });
    await waitFor(() =>
      expect(screen.getByText("Owner two trips")).toBeTruthy(),
    );
    await act(async () => {
      oldRefresh.resolve(
        page([favorites, collection(12, "Late owner one trips")]),
      );
    });
    await waitFor(() =>
      expect(
        client.getQueryState(pocketCollectionsQueryKey(1))?.fetchStatus,
      ).toBe("idle"),
    );

    expect(screen.getByText("Owner two trips")).toBeTruthy();
    expect(screen.queryByText("Late owner one trips")).toBeNull();
    await act(async () => {
      useAuthStore.getState().clearUser();
    });

    expect(screen.queryByText("Owner two trips")).toBeNull();
    expect(screen.queryByText("Favorites")).toBeNull();
    expect(
      screen.getByTestId("my-pockets-list").props.refreshControl.props.enabled,
    ).toBe(false);
    await refresh(screen);
    await scrollToEnd(screen);
    expect(getPocketCollections).toHaveBeenCalledTimes(3);
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(router.push).toHaveBeenCalledWith("/(auth)/login");
  });

  it("resets pagination permission when the account changes", async () => {
    const ownerTwo = collection(21, "Owner two trips");
    jest
      .mocked(getPocketCollections)
      .mockResolvedValueOnce(page([favorites, weekend], 1, true, 3))
      .mockResolvedValueOnce(
        page([collection(22, "Favorites", 0, true), ownerTwo], 1, true, 3),
      )
      .mockResolvedValueOnce(page([coffee], 2, false, 3));
    const screen = await loadedOverview();
    await fireEvent(screen.getByTestId("my-pockets-list"), "scrollBeginDrag");
    await act(async () => {
      useAuthStore.getState().setUser(user(2));
    });
    await waitFor(() =>
      expect(screen.getByText("Owner two trips")).toBeTruthy(),
    );
    await fireEvent(screen.getByTestId("my-pockets-list"), "endReached");

    expect(getPocketCollections).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Weekend food trips")).toBeNull();
    await scrollToEnd(screen);
    await waitFor(() => expect(screen.getByText("Coffee spots")).toBeTruthy());
    expect(getPocketCollections).toHaveBeenCalledTimes(3);
    expect(getPocketCollections).toHaveBeenLastCalledWith(2);
  });
  it("creates a custom Pocket and reloads the overview without changing navigation", async () => {
    const created = collection(60, "New Pocket", 0);
    jest
      .mocked(getPocketCollections)
      .mockResolvedValueOnce(page())
      .mockResolvedValue(page([favorites, weekend, created]));
    jest
      .mocked(createPocketCollection)
      .mockResolvedValue({ success: true, message: "Created.", data: created });
    const screen = await loadedOverview();
    await fireEvent.press(
      screen.getByRole("button", { name: "Create Pocket" }),
    );
    await fireEvent.changeText(
      screen.getByLabelText("Pocket name"),
      "New Pocket",
    );
    await fireEvent.press(
      screen.getAllByRole("button", { name: "Create Pocket" }).at(-1)!,
    );
    await waitFor(() =>
      expect(screen.queryByLabelText("Pocket name")).toBeNull(),
    );
    expect(screen.getByText("New Pocket")).toBeTruthy();
    expect(screen.getByText("Favorites")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Open New Pocket Pocket" }),
    );
    expect(router.push).toHaveBeenCalledWith("/(explorer)/profile/pockets/60");
  });
  it("drops the creation form when the authenticated owner changes", async () => {
    const screen = await loadedOverview();
    await fireEvent.press(
      screen.getByRole("button", { name: "Create Pocket" }),
    );
    await fireEvent.changeText(
      screen.getByLabelText("Pocket name"),
      "Private draft",
    );
    await act(async () => useAuthStore.getState().setUser(user(2)));
    expect(screen.queryByLabelText("Pocket name")).toBeNull();
    expect(createPocketCollection).not.toHaveBeenCalled();
  });
  it("offers custom management separately from navigation and refreshes a renamed Pocket", async () => {
    const renamed = { ...weekend, name: "Weekend favorites" };
    jest.mocked(renamePocketCollection).mockImplementationOnce(async () => {
      jest
        .mocked(getPocketCollections)
        .mockResolvedValue(page([favorites, renamed]));
      return { success: true, message: "Renamed.", data: renamed };
    });
    const screen = await loadedOverview();
    expect(screen.getByRole("header", { name: "DEFAULT" })).toBeTruthy();
    expect(screen.getByRole("header", { name: "YOUR POCKETS" })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Manage Favorites Pocket" }),
    ).toBeNull();
    await fireEvent.press(
      screen.getByRole("button", { name: "Manage Weekend food trips Pocket" }),
    );
    expect(router.push).not.toHaveBeenCalled();
    await fireEvent.press(
      screen.getByRole("button", { name: "Rename Pocket" }),
    );
    await fireEvent.changeText(
      screen.getByLabelText("Pocket name"),
      renamed.name,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Save name" }));
    await waitFor(() =>
      expect(screen.queryByLabelText("Pocket name")).toBeNull(),
    );
    expect(screen.getByText(renamed.name)).toBeTruthy();
    expect(renamePocketCollection).toHaveBeenCalledWith(
      weekend.id,
      renamed.name,
    );
  });
  it("finishes deletion after the refreshed list removes its selected row", async () => {
    jest.mocked(deletePocketCollection).mockImplementationOnce(async () => {
      jest.mocked(getPocketCollections).mockResolvedValue(page([favorites]));
      return { success: true, message: "Deleted.", data: { id: weekend.id } };
    });
    const screen = await loadedOverview();
    await fireEvent.press(
      screen.getByRole("button", { name: "Manage Weekend food trips Pocket" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Delete Pocket" }),
    );
    expect(deletePocketCollection).not.toHaveBeenCalled();
    await fireEvent.press(
      screen.getByRole("button", { name: "Confirm deletion" }),
    );
    await waitFor(() =>
      expect(screen.queryByText("Delete this Pocket?")).toBeNull(),
    );
    expect(screen.queryByText(weekend.name)).toBeNull();
    expect(screen.getByText("Favorites")).toBeTruthy();
    expect(deletePocketCollection).toHaveBeenCalledWith(weekend.id);
  });
});
