import { refreshAccessToken } from "@/features/auth/api/token.service";

import {
  beginAuthSession,
  getAuthSessionGeneration,
  invalidateAuthSession,
  StaleAuthSessionError,
} from "../authSessionGeneration.service";
import { refreshSession } from "../refresh.service";
import { getRefreshToken, saveSessionTokens } from "../storage.service";

jest.mock("../storage.service", () => ({
  getRefreshToken: jest.fn(),
  saveSessionTokens: jest.fn(),
}));

jest.mock("@/features/auth/api/token.service", () => ({
  refreshAccessToken: jest.fn(),
}));

const mockedGetRefreshToken = jest.mocked(getRefreshToken);
const mockedSaveSessionTokens = jest.mocked(saveSessionTokens);
const mockedRefreshAccessToken = jest.mocked(refreshAccessToken);

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

describe("refreshSession", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    beginAuthSession();
    mockedGetRefreshToken.mockResolvedValue("old-refresh-token");
    mockedSaveSessionTokens.mockResolvedValue(true);
  });

  it("refreshes once, rotates tokens, and persists them for the same session", async () => {
    const generation = getAuthSessionGeneration();
    mockedRefreshAccessToken.mockResolvedValue({
      access: "new-access-token",
      refresh: "new-refresh-token",
    });

    const first = refreshSession(generation);
    const second = refreshSession(generation);

    await expect(Promise.all([first, second])).resolves.toEqual([
      "new-access-token",
      "new-access-token",
    ]);
    expect(mockedRefreshAccessToken).toHaveBeenCalledTimes(1);
    expect(mockedRefreshAccessToken).toHaveBeenCalledWith("old-refresh-token");
    expect(mockedSaveSessionTokens).toHaveBeenCalledWith(
      "new-access-token",
      "new-refresh-token",
      generation,
    );
  });

  it("preserves the current refresh token when the backend does not rotate it", async () => {
    const generation = getAuthSessionGeneration();
    mockedRefreshAccessToken.mockResolvedValue({ access: "new-access-token" });

    await expect(refreshSession(generation)).resolves.toBe("new-access-token");
    expect(mockedSaveSessionTokens).toHaveBeenCalledWith(
      "new-access-token",
      undefined,
      generation,
    );
  });

  it("throws when the current session has no refresh token", async () => {
    mockedGetRefreshToken.mockResolvedValue(null);

    await expect(refreshSession()).rejects.toThrow(
      "No refresh token available",
    );
    expect(mockedRefreshAccessToken).not.toHaveBeenCalled();
  });

  it("does not start refresh work after the session has been invalidated", async () => {
    invalidateAuthSession();

    await expect(refreshSession()).rejects.toBeInstanceOf(
      StaleAuthSessionError,
    );
    expect(mockedGetRefreshToken).not.toHaveBeenCalled();
    expect(mockedRefreshAccessToken).not.toHaveBeenCalled();
  });

  it("cannot persist an old response after logout invalidates its session", async () => {
    const generation = getAuthSessionGeneration();
    const response = createDeferred<{
      access: string;
      refresh: string;
    }>();
    const started = createDeferred<void>();
    mockedRefreshAccessToken.mockImplementation(() => {
      started.resolve();
      return response.promise;
    });

    const refresh = refreshSession(generation);
    await started.promise;
    invalidateAuthSession();
    response.resolve({ access: "stale-access", refresh: "stale-refresh" });

    await expect(refresh).rejects.toBeInstanceOf(StaleAuthSessionError);
    expect(mockedSaveSessionTokens).not.toHaveBeenCalled();
  });

  it("cannot overwrite Account B when Account A's refresh completes later", async () => {
    const accountAGeneration = getAuthSessionGeneration();
    const response = createDeferred<{
      access: string;
      refresh: string;
    }>();
    const started = createDeferred<void>();
    mockedRefreshAccessToken.mockImplementation(() => {
      started.resolve();
      return response.promise;
    });

    const accountARefresh = refreshSession(accountAGeneration);
    await started.promise;
    const accountBGeneration = beginAuthSession();
    response.resolve({
      access: "account-a-access",
      refresh: "account-a-refresh",
    });

    await expect(accountARefresh).rejects.toBeInstanceOf(StaleAuthSessionError);
    expect(getAuthSessionGeneration()).toBe(accountBGeneration);
    expect(mockedSaveSessionTokens).not.toHaveBeenCalled();
  });

  it("reports an old refresh failure as stale after a newer session begins", async () => {
    const accountAGeneration = getAuthSessionGeneration();
    const response = createDeferred<never>();
    const started = createDeferred<void>();
    mockedRefreshAccessToken.mockImplementation(() => {
      started.resolve();
      return response.promise;
    });

    const accountARefresh = refreshSession(accountAGeneration);
    await started.promise;
    beginAuthSession();
    response.reject(new Error("old refresh rejected"));

    await expect(accountARefresh).rejects.toBeInstanceOf(StaleAuthSessionError);
  });
});
