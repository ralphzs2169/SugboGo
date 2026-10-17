import NetInfo from "@react-native-community/netinfo";
import MockAdapter from "axios-mock-adapter";
import { router } from "expo-router";

import { useAppModeStore } from "@/features/app-mode/store/appMode.store";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { queryClient } from "@/shared/query/queryClient";

import apiClient from "../apiClient.service";
import { beginAuthSession } from "../authSessionGeneration.service";
import { refreshSession } from "../refresh.service";
import { clearSessionTokens, getAccessToken } from "../storage.service";

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(),
  },
}));

jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
}));

jest.mock("../storage.service", () => ({
  clearSessionTokens: jest.fn(),
  getAccessToken: jest.fn(),
}));

jest.mock("../refresh.service", () => ({
  refreshSession: jest.fn(),
}));

const mockedGetAccessToken = jest.mocked(getAccessToken);
const mockedClearSessionTokens = jest.mocked(clearSessionTokens);
const mockedRefreshSession = jest.mocked(refreshSession);
const mockAxios = new MockAdapter(apiClient);

const accountA = {
  id: 1,
  first_name: "Account",
  last_name: "A",
  gender: null,
  email: "a@example.com",
  role: "merchant" as const,
  status: "active",
  has_completed_interest_selection: true,
  has_custom_profile_picture: false,
  has_oauth_accounts: false,
};

const accountB = {
  ...accountA,
  id: 2,
  last_name: "B",
  email: "b@example.com",
  role: "explorer" as const,
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

describe("apiClient authentication interceptors", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios.reset();
    queryClient.clear();
    beginAuthSession();
    useAuthStore.setState({
      user: accountA,
      isAuthenticated: true,
      sessionExpired: false,
    });
    useAppModeStore.setState({ activeMode: "merchant" });
    jest.mocked(NetInfo.fetch).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    } as Awaited<ReturnType<typeof NetInfo.fetch>>);
    mockedGetAccessToken.mockResolvedValue("access-a");
    mockedClearSessionTokens.mockResolvedValue(true);
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("attaches the current access token", async () => {
    mockAxios.onGet("/users/me/").reply((config) => {
      expect(config.headers?.Authorization).toBe("Bearer access-a");
      return [200, { id: 1 }];
    });

    await expect(apiClient.get("/users/me/")).resolves.toMatchObject({
      status: 200,
    });
  });

  it("refreshes normally and retries with the replacement access token", async () => {
    mockedGetAccessToken
      .mockResolvedValueOnce("expired-access")
      .mockResolvedValue("new-access");
    mockedRefreshSession.mockResolvedValue("new-access");
    let requestCount = 0;

    mockAxios.onGet("/users/me/").reply((config) => {
      requestCount += 1;

      if (requestCount === 1) {
        return [401, { detail: "Token expired" }];
      }

      expect(config.headers?.Authorization).toBe("Bearer new-access");
      return [200, { id: 1 }];
    });

    await expect(apiClient.get("/users/me/")).resolves.toMatchObject({
      status: 200,
    });
    expect(mockedRefreshSession).toHaveBeenCalledTimes(1);
    expect(mockedRefreshSession).toHaveBeenCalledWith(expect.any(Number));
    expect(requestCount).toBe(2);
  });

  it("does not refresh a request whose session changed before its 401 arrives", async () => {
    const response = createDeferred<[number, object]>();
    const requestStarted = createDeferred<void>();
    mockAxios.onGet("/slow/").reply(() => {
      requestStarted.resolve();
      return response.promise;
    });

    const oldRequest = apiClient.get("/slow/");
    await requestStarted.promise;
    beginAuthSession();
    useAuthStore.getState().setUser(accountB);
    useAppModeStore.getState().resetActiveMode();
    response.resolve([401, { detail: "Token expired" }]);

    await expect(oldRequest).rejects.toBeDefined();
    expect(mockedRefreshSession).not.toHaveBeenCalled();
    expect(mockedClearSessionTokens).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user).toEqual(accountB);
  });

  it("does not let a stale refresh failure expire a newer account", async () => {
    const refreshFailure = createDeferred<never>();
    const refreshStarted = createDeferred<void>();
    mockedRefreshSession.mockImplementation(() => {
      refreshStarted.resolve();
      return refreshFailure.promise;
    });
    mockAxios.onGet("/protected/").reply(401, { detail: "Token expired" });

    const oldRequest = apiClient.get("/protected/");
    await refreshStarted.promise;
    beginAuthSession();
    useAuthStore.getState().setUser(accountB);
    useAppModeStore.getState().resetActiveMode();
    refreshFailure.reject(new Error("Account A refresh failed"));

    await expect(oldRequest).rejects.toBeDefined();
    expect(mockedClearSessionTokens).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user).toEqual(accountB);
    expect(useAuthStore.getState().sessionExpired).toBe(false);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("expires only the current session after a genuine refresh failure", async () => {
    mockedRefreshSession.mockRejectedValue(new Error("refresh rejected"));
    mockAxios.onGet("/protected/").reply(401, { detail: "Token expired" });

    await expect(apiClient.get("/protected/")).rejects.toBeDefined();

    expect(mockedClearSessionTokens).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().sessionExpired).toBe(true);
    expect(useAppModeStore.getState().activeMode).toBe("explorer");
    expect(router.replace).toHaveBeenCalledWith("/(auth)/login");
  });
});
