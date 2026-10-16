import { useAppModeStore } from "@/features/app-mode/store/appMode.store";
import { useAuthStore } from "@/features/auth/store/auth.store";
import type { AuthResponse } from "@/features/auth/types/auth.types";
import { StaleAuthSessionError } from "@/shared/api/authSessionGeneration.service";
import {
  clearSessionTokens,
  saveSessionTokens,
} from "@/shared/api/storage.service";
import { queryClient } from "@/shared/query/queryClient";

import { establishSession } from "../authSession";

jest.mock("@/shared/api/storage.service", () => ({
  clearSessionTokens: jest.fn(),
  saveSessionTokens: jest.fn(),
}));

const mockedClearSessionTokens = jest.mocked(clearSessionTokens);
const mockedSaveSessionTokens = jest.mocked(saveSessionTokens);

const explorerSession: AuthResponse = {
  access: "explorer-access",
  refresh: "explorer-refresh",
  user: {
    id: 1,
    first_name: "Explorer",
    last_name: "Account",
    gender: null,
    email: "explorer@example.com",
    role: "explorer",
    status: "active",
    has_completed_interest_selection: true,
    has_custom_profile_picture: false,
    has_oauth_accounts: false,
  },
};

const merchantSession: AuthResponse = {
  access: "merchant-access",
  refresh: "merchant-refresh",
  user: {
    ...explorerSession.user,
    id: 2,
    first_name: "Merchant",
    email: "merchant@example.com",
    role: "merchant",
  },
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

describe("establishSession", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
    useAuthStore.setState({ user: null, isAuthenticated: false });
    useAppModeStore.setState({ activeMode: "merchant" });
    mockedSaveSessionTokens.mockResolvedValue(true);
    mockedClearSessionTokens.mockResolvedValue(true);
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("persists credentials, authenticates the user, and starts in Explorer mode", async () => {
    await establishSession(explorerSession);

    expect(mockedSaveSessionTokens).toHaveBeenCalledWith(
      "explorer-access",
      "explorer-refresh",
      expect.any(Number),
    );
    expect(useAuthStore.getState().user).toEqual(explorerSession.user);
    expect(useAppModeStore.getState().activeMode).toBe("explorer");
  });

  it("does not let an older login replace a newer account", async () => {
    const accountAWrite = createDeferred<boolean>();
    const accountBWrite = createDeferred<boolean>();
    mockedSaveSessionTokens.mockImplementation((accessToken) =>
      accessToken === "explorer-access"
        ? accountAWrite.promise
        : accountBWrite.promise,
    );

    const accountALogin = establishSession(explorerSession);
    const accountBLogin = establishSession(merchantSession);

    accountBWrite.resolve(true);
    await expect(accountBLogin).resolves.toBeUndefined();
    accountAWrite.resolve(true);

    await expect(accountALogin).rejects.toBeInstanceOf(StaleAuthSessionError);
    expect(useAuthStore.getState().user).toEqual(merchantSession.user);
    expect(useAppModeStore.getState().activeMode).toBe("explorer");
  });

  it("still allows an eligible Merchant to switch modes after login", async () => {
    await establishSession(merchantSession);

    useAppModeStore.getState().setActiveMode("merchant");

    expect(useAuthStore.getState().user?.role).toBe("merchant");
    expect(useAppModeStore.getState().activeMode).toBe("merchant");
  });
});
