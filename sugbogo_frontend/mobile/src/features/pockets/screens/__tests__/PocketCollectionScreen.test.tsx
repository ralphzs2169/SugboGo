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
import type {
  ExploreBusiness,
  ExploreBusinessListResponse,
} from "@/features/explore/types/exploreBusiness.types";
import type { User } from "@/features/users/types/user.types";
import type {
  ApiError,
  ApiResponse,
  ApiSuccessWithData,
} from "@/shared/types/apiResponse.types";

import {
  getPocketCollection,
  getPocketCollectionBusinesses,
  deletePocketCollection,
  removePocketCollectionBusiness,
} from "../../api/pockets.service";
import type { PocketCollection } from "../../types/pockets.types";
import PocketCollectionScreen from "../PocketCollectionScreen";

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

jest.mock("../../api/pockets.service", () => ({
  getPocketCollection: jest.fn(),
  getPocketCollectionBusinesses: jest.fn(),
  deletePocketCollection: jest.fn(),
  removePocketCollectionBusiness: jest.fn(),
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
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
          accessibilityLabel={
            props.confirmText === "Remove business"
              ? "Confirm removal"
              : "Confirm deletion"
          }
          disabled={props.isLoading}
          onPress={props.onConfirm}
        >
          <Text>{props.confirmText}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            props.confirmText === "Remove business"
              ? "Cancel removal"
              : "Cancel deletion"
          }
          disabled={props.isLoading}
          onPress={props.onCancel}
        >
          <Text>Cancel</Text>
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
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  useNavigation: () => ({ isFocused: () => true }),
  Stack: { Screen: () => null },
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }),
}));

type Screen = Awaited<ReturnType<typeof render>>;
const initialAuthState = useAuthStore.getState();
const apiError: ApiError = {
  success: false,
  code: "NETWORK_ERROR",
  message: "Offline",
};
const notFound: ApiError = {
  success: false,
  code: "NOT_FOUND",
  message: "The Pocket could not be found.",
};

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

function metadata(id = 20, count = 2): ApiSuccessWithData<PocketCollection> {
  return {
    success: true,
    message: "Pocket retrieved successfully.",
    data: {
      id,
      name: id === 20 ? "Favorites" : `Pocket ${id}`,
      is_default: id === 20,
      business_count: count,
      created_at: "2026-10-19T02:00:00Z",
      updated_at: "2026-10-19T03:00:00Z",
    },
  };
}

function business(id: number): ExploreBusiness {
  return {
    id,
    business_name: `Business ${id}`,
    cover_photo_url: null,
    display_cover_photo_url: null,
    review_count: 0,
    overall_vibe: null,
    is_pocketed: true,
    cluster: { id: 1, name: "Culinary", icon: "utensils" },
    category: { id: 8, name: "Cafe" },
    specialty_tags: [],
    location: {
      address: "Cebu",
      city: "Cebu City",
      province: "Cebu",
      latitude: 10.31,
      longitude: 123.89,
    },
  };
}

function page(
  ids = [81, 7],
  pageNumber = 1,
  hasNext = false,
  total = ids.length,
): ApiSuccessWithData<ExploreBusinessListResponse> {
  return {
    success: true,
    message: "Success.",
    data: {
      items: ids.map(business),
      pagination: {
        page: pageNumber,
        page_size: 2,
        total_items: total,
        total_pages: Math.ceil(total / 2),
        has_next: hasNext,
        has_previous: pageNumber > 1,
      },
    },
  };
}

function pendingResponse<T>() {
  let resolve!: (response: ApiResponse<T>) => void;
  const promise = new Promise<ApiResponse<T>>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("PocketCollectionScreen", () => {
  let client: QueryClient;
  beforeEach(() => {
    jest.mocked(getPocketCollection).mockReset().mockResolvedValue(metadata());
    jest
      .mocked(getPocketCollectionBusinesses)
      .mockReset()
      .mockResolvedValue(page());
    jest.mocked(router.canGoBack).mockReturnValue(true);
    jest
      .mocked(deletePocketCollection)
      .mockReset()
      .mockResolvedValue({
        success: true,
        message: "Deleted.",
        data: { id: 30 },
      });
    jest
      .mocked(removePocketCollectionBusiness)
      .mockReset()
      .mockResolvedValue({
        success: true,
        message: "Removed.",
        data: { business_id: 81, pocket_ids: [30], is_pocketed: true },
      });
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
  async function loaded() {
    const screen = await render(<PocketCollectionScreen collectionId={20} />, {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(screen.getByText("Business 81")).toBeTruthy());
    return screen;
  }
  async function refresh(screen: Screen) {
    await act(async () => {
      screen
        .getByTestId("pocket-businesses-list")
        .props.refreshControl.props.onRefresh();
    });
  }
  async function scrollToEnd(screen: Screen) {
    await fireEvent(
      screen.getByTestId("pocket-businesses-list"),
      "scrollBeginDrag",
    );
    await fireEvent(screen.getByTestId("pocket-businesses-list"), "endReached");
  }

  it("keeps an initial loading state until metadata and businesses are available", async () => {
    const details = pendingResponse<PocketCollection>();
    const businesses = pendingResponse<ExploreBusinessListResponse>();
    jest.mocked(getPocketCollection).mockReturnValueOnce(details.promise);
    jest
      .mocked(getPocketCollectionBusinesses)
      .mockReturnValueOnce(businesses.promise);
    const screen = await render(<PocketCollectionScreen collectionId={20} />, {
      wrapper: Wrapper,
    });
    expect(screen.getByTestId("pocket-detail-loading")).toBeTruthy();
    expect(screen.queryByTestId("pocket-detail-empty")).toBeNull();
    await act(async () => details.resolve(metadata()));
    await waitFor(() => expect(screen.getByText("Favorites")).toBeTruthy());
    expect(screen.getByTestId("pocket-detail-loading")).toBeTruthy();
    await act(async () => businesses.resolve(page()));
    await waitFor(() => expect(screen.getByText("Business 81")).toBeTruthy());
    expect(screen.queryByTestId("pocket-detail-loading")).toBeNull();
  }, 15000);

  it("renders metadata and business order and opens the existing business profile", async () => {
    const screen = await loaded();
    expect(screen.getByText("Favorites")).toBeTruthy();
    expect(screen.getByText("Default")).toBeTruthy();
    expect(screen.getByText("2 businesses")).toBeTruthy();
    expect(
      screen.getAllByText(/^Business \d+$/).map((node) => node.props.children),
    ).toEqual(["Business 81", "Business 7"]);
    await fireEvent.press(
      screen.getByRole("button", { name: "Open Business 81 business profile" }),
    );
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(explorer)/business/[businessId]",
      params: { businessId: "81" },
    });
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByPlaceholderText(/search/i)).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: /^(create|rename|delete|filter|sort)/i,
      }),
    ).toBeNull();
  });

  it("preserves zero-business Favorites as a successful empty collection", async () => {
    jest.mocked(getPocketCollection).mockResolvedValueOnce(metadata(20, 0));
    jest.mocked(getPocketCollectionBusinesses).mockResolvedValueOnce(page([]));
    const screen = await render(<PocketCollectionScreen collectionId={20} />, {
      wrapper: Wrapper,
    });
    await waitFor(() =>
      expect(screen.getByTestId("pocket-detail-empty")).toBeTruthy(),
    );
    expect(screen.getByText("Favorites")).toBeTruthy();
    expect(screen.getByText("Default")).toBeTruthy();
    expect(screen.getByText("0 businesses")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  });

  it("retries an initial metadata failure without refetching successful contents", async () => {
    jest
      .mocked(getPocketCollection)
      .mockResolvedValueOnce(apiError)
      .mockResolvedValueOnce(metadata());
    const screen = await render(<PocketCollectionScreen collectionId={20} />, {
      wrapper: Wrapper,
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy(),
    );
    expect(screen.queryByText("Business 81")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByText("Business 81")).toBeTruthy());
    expect(getPocketCollection).toHaveBeenCalledTimes(2);
    expect(getPocketCollectionBusinesses).toHaveBeenCalledTimes(1);
  });

  it("retries an initial business failure while preserving the collection summary", async () => {
    jest
      .mocked(getPocketCollectionBusinesses)
      .mockResolvedValueOnce(apiError)
      .mockResolvedValueOnce(page());
    const screen = await render(<PocketCollectionScreen collectionId={20} />, {
      wrapper: Wrapper,
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy(),
    );
    expect(screen.getByText("Favorites")).toBeTruthy();
    expect(screen.queryByTestId("pocket-detail-empty")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByText("Business 81")).toBeTruthy());
    expect(getPocketCollection).toHaveBeenCalledTimes(1);
    expect(getPocketCollectionBusinesses).toHaveBeenCalledTimes(2);
  });

  it("shows recovery for an unexpected non-object query failure", async () => {
    jest
      .mocked(getPocketCollection)
      .mockRejectedValueOnce("Unexpected response");
    const screen = await render(<PocketCollectionScreen collectionId={20} />, {
      wrapper: Wrapper,
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy(),
    );
    expect(screen.queryByText("Business 81")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByText("Business 81")).toBeTruthy());
  });

  it("refreshes both queries once, keeps rows visible, and adopts server results", async () => {
    const details = pendingResponse<PocketCollection>();
    const businesses = pendingResponse<ExploreBusinessListResponse>();
    jest
      .mocked(getPocketCollection)
      .mockResolvedValueOnce(metadata())
      .mockReturnValueOnce(details.promise);
    jest
      .mocked(getPocketCollectionBusinesses)
      .mockResolvedValueOnce(page())
      .mockReturnValueOnce(businesses.promise);
    const screen = await loaded();
    await refresh(screen);
    await refresh(screen);
    await waitFor(() =>
      expect(
        screen.getByTestId("pocket-businesses-list").props.refreshControl.props
          .refreshing,
      ).toBe(true),
    );
    expect(screen.getByText("Business 81")).toBeTruthy();
    expect(getPocketCollection).toHaveBeenCalledTimes(2);
    expect(getPocketCollectionBusinesses).toHaveBeenCalledTimes(2);
    await act(async () => {
      details.resolve(metadata(20, 1));
      businesses.resolve(page([40]));
    });
    await waitFor(() => expect(screen.getByText("Business 40")).toBeTruthy());
    expect(screen.getByText("1 business")).toBeTruthy();
    expect(screen.queryByText("Business 81")).toBeNull();
  });

  it("keeps loaded content after refresh failures and retries each failed query separately", async () => {
    jest
      .mocked(getPocketCollection)
      .mockResolvedValueOnce(metadata())
      .mockResolvedValueOnce(apiError)
      .mockResolvedValueOnce(metadata(20, 1));
    jest
      .mocked(getPocketCollectionBusinesses)
      .mockResolvedValueOnce(page())
      .mockResolvedValueOnce(apiError)
      .mockResolvedValueOnce(page([40]));
    const screen = await loaded();
    await refresh(screen);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /retry details/i }),
      ).toBeTruthy(),
    );
    expect(screen.getByText("Business 81")).toBeTruthy();
    expect(screen.getByText("Favorites")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: /retry details/i }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /retry details/i }),
      ).toBeNull(),
    );
    expect(getPocketCollectionBusinesses).toHaveBeenCalledTimes(2);
    await fireEvent.press(
      screen.getByRole("button", { name: /retry businesses/i }),
    );
    await waitFor(() => expect(screen.getByText("Business 40")).toBeTruthy());
    expect(getPocketCollection).toHaveBeenCalledTimes(3);
    expect(getPocketCollectionBusinesses).toHaveBeenCalledTimes(3);
  });

  it("keeps an empty refresh failure distinct from a successful empty list", async () => {
    jest.mocked(getPocketCollection).mockResolvedValue(metadata(20, 0));
    jest
      .mocked(getPocketCollectionBusinesses)
      .mockResolvedValueOnce(page([]))
      .mockResolvedValueOnce(apiError)
      .mockResolvedValueOnce(page([]));
    const screen = await render(<PocketCollectionScreen collectionId={20} />, {
      wrapper: Wrapper,
    });
    await waitFor(() =>
      expect(screen.getByTestId("pocket-detail-empty")).toBeTruthy(),
    );
    await refresh(screen);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy(),
    );
    expect(screen.queryByTestId("pocket-detail-empty")).toBeNull();
    expect(screen.getByText("Favorites")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(screen.getByTestId("pocket-detail-empty")).toBeTruthy(),
    );
  });

  it("guards duplicate pagination, retains rows after a page 404, and retries without refreshing metadata", async () => {
    const next = pendingResponse<ExploreBusinessListResponse>();
    const retry = pendingResponse<ExploreBusinessListResponse>();
    jest.mocked(getPocketCollection).mockResolvedValue(metadata(20, 3));
    jest
      .mocked(getPocketCollectionBusinesses)
      .mockResolvedValueOnce(page([81, 7], 1, true, 3))
      .mockReturnValueOnce(next.promise)
      .mockReturnValueOnce(retry.promise);
    const screen = await loaded();
    await scrollToEnd(screen);
    await fireEvent(screen.getByTestId("pocket-businesses-list"), "endReached");
    await waitFor(() =>
      expect(screen.getByTestId("pocket-businesses-page-loader")).toBeTruthy(),
    );
    expect(screen.getByText("Business 81")).toBeTruthy();
    expect(
      screen.getByTestId("pocket-businesses-list").props.refreshControl.props
        .refreshing,
    ).toBe(false);
    await refresh(screen);
    expect(getPocketCollectionBusinesses).toHaveBeenCalledTimes(2);
    expect(getPocketCollection).toHaveBeenCalledTimes(1);
    await act(async () =>
      next.resolve({ ...notFound, message: "Invalid page." }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /retry businesses/i }),
      ).toBeTruthy(),
    );
    expect(screen.getByText("Business 81")).toBeTruthy();
    expect(screen.queryByText("Pocket unavailable")).toBeNull();
    await scrollToEnd(screen);
    expect(getPocketCollectionBusinesses).toHaveBeenCalledTimes(2);
    await fireEvent.press(
      screen.getByRole("button", { name: /retry businesses/i }),
    );
    expect(getPocketCollectionBusinesses).toHaveBeenCalledTimes(3);
    await act(async () => retry.resolve(page([7, 40], 2, false, 3)));
    await waitFor(() => expect(screen.getByText("Business 40")).toBeTruthy());
    expect(
      screen.getAllByText(/^Business \d+$/).map((node) => node.props.children),
    ).toEqual(["Business 81", "Business 7", "Business 40"]);
    expect(screen.getByText("You're all caught up")).toBeTruthy();
    await scrollToEnd(screen);
    expect(getPocketCollectionBusinesses).toHaveBeenCalledTimes(3);
  });

  it("waits for auth restoration and prevents signed-out requests", async () => {
    useAuthStore.setState({ isLoading: true });
    const screen = await render(<PocketCollectionScreen collectionId={20} />, {
      wrapper: Wrapper,
    });
    expect(screen.getByTestId("pocket-detail-loading")).toBeTruthy();
    await refresh(screen);
    await scrollToEnd(screen);
    expect(getPocketCollection).not.toHaveBeenCalled();
    expect(getPocketCollectionBusinesses).not.toHaveBeenCalled();
    await act(async () => useAuthStore.setState({ isLoading: false }));
    await waitFor(() => expect(screen.getByText("Business 81")).toBeTruthy());
    await act(async () => useAuthStore.getState().clearUser());
    expect(screen.queryByText("Business 81")).toBeNull();
    expect(screen.queryByText("Favorites")).toBeNull();
    await refresh(screen);
    await scrollToEnd(screen);
    expect(getPocketCollectionBusinesses).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(router.push).toHaveBeenCalledWith("/(auth)/login");
  });

  it("hides previous-account content and ignores late refresh responses", async () => {
    const oldDetails = pendingResponse<PocketCollection>();
    const oldBusinesses = pendingResponse<ExploreBusinessListResponse>();
    jest
      .mocked(getPocketCollection)
      .mockResolvedValueOnce(metadata())
      .mockReturnValueOnce(oldDetails.promise)
      .mockResolvedValueOnce(notFound);
    jest
      .mocked(getPocketCollectionBusinesses)
      .mockResolvedValueOnce(page())
      .mockReturnValueOnce(oldBusinesses.promise)
      .mockResolvedValueOnce(notFound);
    const screen = await loaded();
    await refresh(screen);
    await act(async () => useAuthStore.setState({ user: user(2) }));
    await waitFor(() =>
      expect(screen.getByText("Pocket unavailable")).toBeTruthy(),
    );
    await act(async () => {
      oldDetails.resolve(metadata());
      oldBusinesses.resolve(page([90]));
    });
    expect(screen.queryByText("Favorites")).toBeNull();
    expect(screen.queryByText("Business 81")).toBeNull();
    expect(screen.queryByText("Business 90")).toBeNull();
  });

  it("resets pagination permission when navigating to a different collection", async () => {
    jest
      .mocked(getPocketCollection)
      .mockResolvedValueOnce(metadata())
      .mockResolvedValueOnce(metadata(30, 3));
    jest
      .mocked(getPocketCollectionBusinesses)
      .mockResolvedValueOnce(page([81, 7], 1, true, 3))
      .mockResolvedValueOnce(page([40, 60], 1, true, 3))
      .mockResolvedValueOnce(page([90], 2, false, 3));
    const screen = await loaded();
    await fireEvent(
      screen.getByTestId("pocket-businesses-list"),
      "scrollBeginDrag",
    );
    await screen.rerender(<PocketCollectionScreen collectionId={30} />);
    await waitFor(() => expect(screen.getByText("Business 40")).toBeTruthy());
    expect(screen.getByText("Pocket 30")).toBeTruthy();
    expect(screen.queryByText("Favorites")).toBeNull();
    await fireEvent(screen.getByTestId("pocket-businesses-list"), "endReached");
    expect(getPocketCollectionBusinesses).toHaveBeenCalledTimes(2);
    await scrollToEnd(screen);
    await waitFor(() => expect(screen.getByText("Business 90")).toBeTruthy());
    expect(getPocketCollectionBusinesses).toHaveBeenLastCalledWith(30, 2);
  });

  it("hides cached contents when metadata becomes unavailable and supports a deep-link escape", async () => {
    jest
      .mocked(getPocketCollection)
      .mockResolvedValueOnce(metadata())
      .mockResolvedValueOnce(notFound);
    jest
      .mocked(getPocketCollectionBusinesses)
      .mockResolvedValueOnce(page())
      .mockResolvedValueOnce(notFound);
    jest.mocked(router.canGoBack).mockReturnValue(false);
    const screen = await loaded();
    await refresh(screen);
    await waitFor(() =>
      expect(screen.getByText("Pocket unavailable")).toBeTruthy(),
    );
    expect(screen.queryByText("Business 81")).toBeNull();
    expect(screen.queryByText("Favorites")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Go back" }));
    expect(router.replace).toHaveBeenCalledWith(
      "/(explorer)/profile/my-pockets",
    );
  });

  it("rejects an invalid route identity without API requests", async () => {
    const screen = await render(
      <PocketCollectionScreen collectionId={null} />,
      { wrapper: Wrapper },
    );
    expect(screen.getByText("Pocket not found")).toBeTruthy();
    expect(getPocketCollection).not.toHaveBeenCalled();
    expect(getPocketCollectionBusinesses).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Go back" }));
    expect(router.back).toHaveBeenCalled();
  });

  it("returns to the overview after deleting the currently open custom Pocket", async () => {
    jest.mocked(getPocketCollection).mockResolvedValue(metadata(30));
    const screen = await render(<PocketCollectionScreen collectionId={30} />, {
      wrapper: Wrapper,
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Manage Pocket 30 Pocket" }),
      ).toBeTruthy(),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Manage Pocket 30 Pocket" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Delete Pocket" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Confirm deletion" }),
    );
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(
        "/(explorer)/profile/my-pockets",
      ),
    );
    expect(deletePocketCollection).toHaveBeenCalledWith(30);
    expect(getPocketCollection).toHaveBeenCalledTimes(1);
  });

  it("removes one business from Favorites and refreshes its server count and contents", async () => {
    jest
      .mocked(removePocketCollectionBusiness)
      .mockImplementationOnce(async () => {
        jest.mocked(getPocketCollection).mockResolvedValue(metadata(20, 1));
        jest.mocked(getPocketCollectionBusinesses).mockResolvedValue(page([7]));
        return {
          success: true,
          message: "Removed.",
          data: { business_id: 81, pocket_ids: [30], is_pocketed: true },
        };
      });
    const screen = await loaded();
    await fireEvent.press(
      screen.getByRole("button", { name: "Remove Business 81 from Favorites" }),
    );
    expect(screen.getByText("Business 81")).toBeTruthy();
    expect(removePocketCollectionBusiness).not.toHaveBeenCalled();
    await fireEvent.press(
      screen.getByRole("button", { name: "Confirm removal" }),
    );
    await waitFor(() => expect(screen.queryByText("Business 81")).toBeNull());
    expect(screen.getByText("Business 7")).toBeTruthy();
    expect(screen.getByText("1 business")).toBeTruthy();
    expect(removePocketCollectionBusiness).toHaveBeenCalledWith(20, 81);
    await fireEvent.press(
      screen.getByRole("button", { name: "Open Business 7 business profile" }),
    );
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(explorer)/business/[businessId]",
      params: { businessId: "7" },
    });
  });

  it("keeps a failed individual removal visible without changing loaded cards", async () => {
    jest.mocked(removePocketCollectionBusiness).mockResolvedValueOnce(apiError);
    const screen = await loaded();
    await fireEvent.press(
      screen.getByRole("button", { name: "Remove Business 81 from Favorites" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Confirm removal" }),
    );
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByText("Business 81")).toBeTruthy();
    expect(screen.getByText("Business 7")).toBeTruthy();
    expect(screen.getByText("2 businesses")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Cancel removal" }),
    );
    expect(screen.queryByText("Remove this business?")).toBeNull();
    expect(removePocketCollectionBusiness).toHaveBeenCalledTimes(1);
  });
});
