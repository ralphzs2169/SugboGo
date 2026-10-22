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
  createPocketCollection,
  renamePocketCollection,
} from "../../api/pockets.service";
import type { PocketCollection } from "../../types/pockets.types";
import PocketNameForm from "../PocketNameForm";

jest.mock("../../api/pockets.service", () => ({
  createPocketCollection: jest.fn(),
  renamePocketCollection: jest.fn(),
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("@/shared/utils/apiErrors", () => ({
  handleSystemError: jest.fn(() => false),
}));
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
  business_count: 0,
  created_at: "2026-10-20T00:00:00Z",
  updated_at: "2026-10-20T00:00:00Z",
};
const success = {
  success: true as const,
  message: "Success.",
  data: collection,
};
const failure = {
  success: false as const,
  code: "VALIDATION_ERROR",
  message: "Invalid Pocket.",
  errors: { name: ["You already have a Pocket with this name."] },
};

describe("Pocket name form", () => {
  let client: QueryClient;
  const saved = jest.fn();
  const cancel = jest.fn();
  beforeEach(() => {
    beginAuthSession();
    useAuthStore.setState({ user, isAuthenticated: true, isLoading: false });
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { gcTime: Infinity },
      },
    });
    jest.mocked(createPocketCollection).mockReset().mockResolvedValue(success);
    jest.mocked(renamePocketCollection).mockReset().mockResolvedValue(success);
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
  const form = (rename = false) =>
    render(
      <PocketNameForm
        collection={rename ? collection : undefined}
        onSuccess={saved}
        onCancel={cancel}
      />,
      { wrapper: Wrapper },
    );

  it("does not create a Pocket after the parent workflow is revoked", async () => {
    let allowed = true;
    const screen = await render(
      <PocketNameForm
        onSuccess={saved}
        onCancel={cancel}
        canSubmit={() => allowed}
      />,
      { wrapper: Wrapper },
    );
    await fireEvent.changeText(
      screen.getByLabelText("Pocket name"),
      "Coffee spots",
    );
    allowed = false;
    await fireEvent.press(
      screen.getByRole("button", { name: "Create Pocket" }),
    );
    expect(createPocketCollection).not.toHaveBeenCalled();
  });
  it("validates a blank name before requesting creation", async () => {
    const screen = await form();
    await fireEvent.changeText(screen.getByLabelText("Pocket name"), "  ");
    await fireEvent(screen.getByLabelText("Pocket name"), "submitEditing");
    expect(screen.getByText("Pocket name is required.")).toBeTruthy();
    expect(createPocketCollection).not.toHaveBeenCalled();
  });
  it("preserves duplicate-name errors and input until a successful retry", async () => {
    jest.mocked(createPocketCollection).mockResolvedValueOnce(failure);
    const screen = await form();
    await fireEvent.changeText(
      screen.getByLabelText("Pocket name"),
      " Coffee ",
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Create Pocket" }),
    );
    await waitFor(() =>
      expect(screen.getByText(failure.errors.name[0])).toBeTruthy(),
    );
    expect(screen.getByLabelText("Pocket name").props.value).toBe(" Coffee ");
    expect(saved).not.toHaveBeenCalled();
    await fireEvent.press(
      screen.getByRole("button", { name: "Create Pocket" }),
    );
    await waitFor(() => expect(saved).toHaveBeenCalledWith(collection));
    expect(createPocketCollection).toHaveBeenLastCalledWith(" Coffee ");
  });
  it("keeps a failed rename editable and uses the stable collection ID", async () => {
    jest.mocked(renamePocketCollection).mockResolvedValueOnce(failure);
    const screen = await form(true);
    await fireEvent.changeText(
      screen.getByLabelText("Pocket name"),
      "New name",
    );
    await fireEvent.press(screen.getByRole("button", { name: "Save name" }));
    await waitFor(() =>
      expect(screen.getByText(failure.errors.name[0])).toBeTruthy(),
    );
    expect(screen.getByLabelText("Pocket name").props.value).toBe("New name");
    expect(renamePocketCollection).toHaveBeenCalledWith(30, "New name");
  });
  it("blocks duplicate submissions and cancellation while a request is pending", async () => {
    let resolve!: (value: typeof success) => void;
    jest.mocked(createPocketCollection).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const screen = await form();
    await fireEvent.changeText(screen.getByLabelText("Pocket name"), "Coffee");
    await fireEvent.press(
      screen.getByRole("button", { name: "Create Pocket" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Create Pocket" }),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    expect(createPocketCollection).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
    await act(async () => resolve(success));
    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  });
  it("discards late UI callbacks after an account switch", async () => {
    let resolve!: (value: typeof success) => void;
    jest.mocked(createPocketCollection).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const screen = await form();
    await fireEvent.changeText(screen.getByLabelText("Pocket name"), "Coffee");
    await fireEvent.press(
      screen.getByRole("button", { name: "Create Pocket" }),
    );
    await act(async () => {
      beginAuthSession();
      useAuthStore.setState({ user: { ...user, id: 2 } });
      resolve(success);
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Create Pocket" }).props
          .accessibilityState.busy,
      ).toBe(false),
    );
    expect(saved).not.toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalled();
    await fireEvent.press(
      screen.getByRole("button", { name: "Create Pocket" }),
    );
    expect(createPocketCollection).toHaveBeenCalledTimes(1);
  });
});
