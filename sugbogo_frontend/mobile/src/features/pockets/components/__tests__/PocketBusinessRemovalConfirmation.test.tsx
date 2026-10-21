import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
import type { PropsWithChildren } from "react";
import Toast from "react-native-toast-message";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { RECOMMENDATIONS_QUERY_KEY } from "@/features/explore/hooks/useRecommendations";
import type { User } from "@/features/users/types/user.types";
import {
  beginAuthSession,
  getAuthSessionGeneration,
} from "@/shared/api/authSessionGeneration.service";
import { removePocketCollectionBusiness } from "../../api/pockets.service";
import {
  businessPocketMembershipsQueryKey,
  pocketCollectionBusinessesQueryKey,
} from "../../hooks/pocketQueryKeys";
import PocketBusinessRemovalConfirmation from "../PocketBusinessRemovalConfirmation";

jest.mock("../../api/pockets.service", () => ({
  removePocketCollectionBusiness: jest.fn(),
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("@/shared/utils/apiErrors", () => ({
  handleSystemError: jest.fn(() => false),
}));
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
          accessibilityLabel={props.confirmText}
          disabled={props.isLoading}
          onPress={props.onConfirm}
        >
          <Text>{props.confirmText}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel removal"
          disabled={props.isLoading}
          onPress={props.onCancel}
        >
          <Text>Cancel</Text>
        </Pressable>
      </View>
    );
  };
});

const initialAuth = useAuthStore.getState();
const user: User = {
  id: 1,
  first_name: "Pocket",
  last_name: "Explorer",
  email: "pocket@example.com",
  gender: null,
  role: "explorer",
  status: "active",
  has_completed_interest_selection: true,
  has_custom_profile_picture: false,
  has_oauth_accounts: false,
};
const success = (saved = true) => ({
  success: true as const,
  message: "Removed.",
  data: { business_id: 42, pocket_ids: saved ? [20] : [], is_pocketed: saved },
});
const failure = {
  success: false as const,
  code: "NETWORK_ERROR",
  message: "Please try again.",
};
const feed = {
  items: [
    { id: 7, is_pocketed: true },
    { id: 42, is_pocketed: true },
  ],
};

describe("individual Pocket business removal", () => {
  let client: QueryClient;
  const close = jest.fn();
  beforeEach(() => {
    beginAuthSession();
    useAuthStore.setState({ user, isAuthenticated: true, isLoading: false });
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { gcTime: Infinity },
      },
    });
    client.setQueryData(RECOMMENDATIONS_QUERY_KEY, feed);
    client.setQueryData(pocketCollectionBusinessesQueryKey(1, 30), {
      pages: [feed],
      pageParams: [1],
    });
    client.setQueryData(pocketCollectionBusinessesQueryKey(2, 50), {
      pages: [feed],
      pageParams: [1],
    });
    jest
      .mocked(removePocketCollectionBusiness)
      .mockReset()
      .mockResolvedValue(success());
  });
  afterEach(async () => {
    await cleanup();
    client.clear();
    useAuthStore.setState(initialAuth);
  });
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  const confirmation = () =>
    render(
      <PocketBusinessRemovalConfirmation
        collectionId={30}
        business={{ id: 42, business_name: "Cafe" }}
        ownerId={1}
        generation={getAuthSessionGeneration()}
        onClose={close}
      />,
      { wrapper: Wrapper },
    );

  it.each([true, false])(
    "uses the authoritative aggregate saved flag %s and preserves recommendation order",
    async (saved) => {
      jest
        .mocked(removePocketCollectionBusiness)
        .mockResolvedValue(success(saved));
      const screen = await confirmation();
      expect(screen.getByText("Remove", { exact: true })).toBeTruthy();
      expect(screen.queryByText("Remove business", { exact: true })).toBeNull();
      await fireEvent.press(screen.getByRole("button", { name: "Remove" }));
      await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
      expect(removePocketCollectionBusiness).toHaveBeenCalledWith(30, 42);
      expect(
        client.getQueryData(businessPocketMembershipsQueryKey(1, 42)),
      ).toEqual(success(saved).data);
      expect(client.getQueryData(RECOMMENDATIONS_QUERY_KEY)).toEqual({
        items: [feed.items[0], { ...feed.items[1], is_pocketed: saved }],
      });
      expect(
        client.getQueryState(pocketCollectionBusinessesQueryKey(2, 50))
          ?.isInvalidated,
      ).toBe(false);
    },
  );
  it("cancels without removing any membership", async () => {
    const screen = await confirmation();
    await fireEvent.press(
      screen.getByRole("button", { name: "Cancel removal" }),
    );
    expect(close).toHaveBeenCalledTimes(1);
    expect(removePocketCollectionBusiness).not.toHaveBeenCalled();
  });
  it("retains cards and saved flags after failure and permits retry", async () => {
    jest.mocked(removePocketCollectionBusiness).mockResolvedValueOnce(failure);
    const screen = await confirmation();
    await fireEvent.press(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(close).not.toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalled();
    expect(client.getQueryData(RECOMMENDATIONS_QUERY_KEY)).toEqual(feed);
    expect(
      client.getQueryData(pocketCollectionBusinessesQueryKey(1, 30)),
    ).toEqual({ pages: [feed], pageParams: [1] });
    await fireEvent.press(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  });
  it("blocks duplicate removal and cancellation while pending", async () => {
    let resolve!: (value: ReturnType<typeof success>) => void;
    jest.mocked(removePocketCollectionBusiness).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const screen = await confirmation();
    await fireEvent.press(screen.getByRole("button", { name: "Remove" }));
    await fireEvent.press(screen.getByRole("button", { name: "Remove" }));
    await fireEvent.press(
      screen.getByRole("button", { name: "Cancel removal" }),
    );
    expect(removePocketCollectionBusiness).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
    expect(client.getQueryData(RECOMMENDATIONS_QUERY_KEY)).toEqual(feed);
    await act(async () => resolve(success()));
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  });
  it("hides a prior account's confirmation and ignores its late removal response", async () => {
    let resolve!: (value: ReturnType<typeof success>) => void;
    jest.mocked(removePocketCollectionBusiness).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const screen = await confirmation();
    await fireEvent.press(screen.getByRole("button", { name: "Remove" }));
    await act(async () => {
      beginAuthSession();
      useAuthStore.setState({ user: { ...user, id: 2 } });
      resolve(success(false));
    });
    await waitFor(() =>
      expect(screen.queryByText("Remove this business?")).toBeNull(),
    );
    expect(client.getQueryData(RECOMMENDATIONS_QUERY_KEY)).toEqual(feed);
    expect(close).not.toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalled();
  });
});
