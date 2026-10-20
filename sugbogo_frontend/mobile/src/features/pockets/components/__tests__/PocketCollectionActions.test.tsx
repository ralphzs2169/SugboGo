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
import type { User } from "@/features/users/types/user.types";
import { beginAuthSession } from "@/shared/api/authSessionGeneration.service";
import {
  deletePocketCollection,
  renamePocketCollection,
} from "../../api/pockets.service";
import { pocketCollectionQueryKey } from "../../hooks/pocketQueryKeys";
import type { PocketCollection } from "../../types/pockets.types";
import PocketCollectionActions from "../PocketCollectionActions";

jest.mock("../../api/pockets.service", () => ({
  deletePocketCollection: jest.fn(),
  renamePocketCollection: jest.fn(),
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
          accessibilityLabel="Confirm deletion"
          disabled={props.isLoading}
          onPress={props.onConfirm}
        >
          <Text>{props.confirmText}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel deletion"
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
const collection: PocketCollection = {
  id: 30,
  name: "Coffee",
  is_default: false,
  business_count: 2,
  created_at: "2026-10-20T00:00:00Z",
  updated_at: "2026-10-20T00:00:00Z",
};
const deleted = {
  success: true as const,
  message: "Deleted.",
  data: { id: 30 },
};
const failure = {
  success: false as const,
  code: "NETWORK_ERROR",
  message: "Please try again.",
};

describe("Pocket collection actions", () => {
  let client: QueryClient;
  const onDeleted = jest.fn();
  beforeEach(() => {
    beginAuthSession();
    useAuthStore.setState({ user, isAuthenticated: true, isLoading: false });
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { gcTime: Infinity },
      },
    });
    jest.mocked(deletePocketCollection).mockReset().mockResolvedValue(deleted);
    jest
      .mocked(renamePocketCollection)
      .mockReset()
      .mockResolvedValue({
        success: true,
        message: "Renamed.",
        data: { ...collection, name: "New coffee" },
      });
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
  const actions = (value = collection) =>
    render(
      <PocketCollectionActions collection={value} onDeleted={onDeleted} />,
      { wrapper: Wrapper },
    );
  it("offers no rename or delete controls for Favorites", async () => {
    const screen = await actions({
      ...collection,
      is_default: true,
      name: "Favorites",
    });
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(deletePocketCollection).not.toHaveBeenCalled();
    expect(renamePocketCollection).not.toHaveBeenCalled();
  });
  it("preserves failed rename input and closes after a successful retry", async () => {
    jest.mocked(renamePocketCollection).mockResolvedValueOnce({
      ...failure,
      errors: { name: ["Name already exists."] },
    });
    const screen = await actions();
    await fireEvent.press(
      screen.getByRole("button", { name: "Rename Pocket" }),
    );
    await fireEvent.changeText(
      screen.getByLabelText("Pocket name"),
      "New coffee",
    );
    await fireEvent.press(screen.getByRole("button", { name: "Save name" }));
    await waitFor(() =>
      expect(screen.getByText("Name already exists.")).toBeTruthy(),
    );
    expect(screen.getByLabelText("Pocket name").props.value).toBe("New coffee");
    await fireEvent.press(screen.getByRole("button", { name: "Save name" }));
    await waitFor(() =>
      expect(screen.queryByLabelText("Pocket name")).toBeNull(),
    );
    expect(renamePocketCollection).toHaveBeenLastCalledWith(30, "New coffee");
    expect(client.getQueryData(pocketCollectionQueryKey(1, 30))).toEqual({
      ...collection,
      name: "New coffee",
    });
    expect(onDeleted).not.toHaveBeenCalled();
  });
  it("requires explicit confirmation and allows canceling deletion without a request", async () => {
    const screen = await actions();
    await fireEvent.press(
      screen.getByRole("button", { name: "Delete Pocket" }),
    );
    expect(screen.getByText("Delete this Pocket?")).toBeTruthy();
    expect(deletePocketCollection).not.toHaveBeenCalled();
    await fireEvent.press(
      screen.getByRole("button", { name: "Cancel deletion" }),
    );
    expect(screen.queryByText("Delete this Pocket?")).toBeNull();
    expect(deletePocketCollection).not.toHaveBeenCalled();
  });
  it("retains failed deletion feedback and returns to the overview only after success", async () => {
    jest.mocked(deletePocketCollection).mockResolvedValueOnce(failure);
    const screen = await actions();
    await fireEvent.press(
      screen.getByRole("button", { name: "Delete Pocket" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Confirm deletion" }),
    );
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(onDeleted).not.toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalled();
    await fireEvent.press(
      screen.getByRole("button", { name: "Confirm deletion" }),
    );
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(deletePocketCollection).toHaveBeenLastCalledWith(30);
  });
  it("prevents duplicate confirmation and cancellation while deletion is pending", async () => {
    let resolve!: (value: typeof deleted) => void;
    jest.mocked(deletePocketCollection).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const screen = await actions();
    await fireEvent.press(
      screen.getByRole("button", { name: "Delete Pocket" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Confirm deletion" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Confirm deletion" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Cancel deletion" }),
    );
    expect(deletePocketCollection).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Delete this Pocket?")).toBeTruthy();
    await act(async () => resolve(deleted));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
  });
  it("hides old-account confirmation and suppresses late success navigation", async () => {
    let resolve!: (value: typeof deleted) => void;
    jest.mocked(deletePocketCollection).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const screen = await actions();
    await fireEvent.press(
      screen.getByRole("button", { name: "Delete Pocket" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Confirm deletion" }),
    );
    await act(async () => {
      beginAuthSession();
      useAuthStore.setState({ user: { ...user, id: 2 } });
      resolve(deleted);
    });
    await waitFor(() =>
      expect(screen.queryByText("Delete this Pocket?")).toBeNull(),
    );
    expect(onDeleted).not.toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalled();
  });
});
