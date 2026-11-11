import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { createServer } from "vite";
import { AxiosError, CanceledError } from "axios";

let server;
let authClient;
let authSession;
let authStore;
let storage;
let originalPost;
let refreshModule;
let apiClient;
let originalAdapter;
const previousStorage = globalThis.localStorage;
const previousSessionStorage = globalThis.sessionStorage;
const previousWindow = globalThis.window;
let redirects;

before(async () => {
  const entries = new Map();
  globalThis.localStorage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  };
  const sessionEntries = new Map();
  globalThis.sessionStorage = {
    getItem: (key) => sessionEntries.get(key) ?? null,
    setItem: (key, value) => sessionEntries.set(key, value),
    removeItem: (key) => sessionEntries.delete(key),
  };
  globalThis.window = {
    location: { replace: (path) => redirects.push(path) },
  };
  server = await createServer({
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, ws: false },
  });
  ({ default: authClient } = await server.ssrLoadModule("/src/shared/api/authClient.js"));
  authSession = await server.ssrLoadModule("/src/features/auth/utils/authSession.js");
  ({ useAuthStore: authStore } = await server.ssrLoadModule("/src/features/auth/storage/auth.store.js"));
  storage = await server.ssrLoadModule("/src/shared/api/storage.js");
  originalPost = authClient.post;
  refreshModule = await server.ssrLoadModule("/src/shared/api/refresh.js");
  ({ default: apiClient } = await server.ssrLoadModule("/src/shared/api/apiClient.js"));
  originalAdapter = apiClient.defaults.adapter;
});

beforeEach(() => {
  redirects = [];
  authClient.post = originalPost;
  apiClient.defaults.adapter = originalAdapter;
  storage.clearSessionExpired();
  storage.setTokens({ access: "access-a", refresh: "refresh-a" });
  authStore.getState().setUser({ id: 7 });
});

after(async () => {
  if (authClient) authClient.post = originalPost;
  if (apiClient) apiClient.defaults.adapter = originalAdapter;
  globalThis.localStorage = previousStorage;
  globalThis.sessionStorage = previousSessionStorage;
  globalThis.window = previousWindow;
  await server?.close();
});

test("web logout captures the old refresh token and immediately clears local authentication", () => {
  const calls = [];
  authClient.post = (...args) => { calls.push(args); return new Promise(() => {}); };
  authSession.logout();
  assert.equal(storage.getAccessToken(), null);
  assert.equal(storage.getRefreshToken(), null);
  assert.equal(authStore.getState().user, null);
  assert.deepEqual(calls, [["/auth/logout/", { refresh: "refresh-a" }, { timeout: 5000 }]]);
});

test("a server failure never restores credentials or overwrites a newer sign-in", async () => {
  let reject;
  authClient.post = () => new Promise((_, fail) => { reject = fail; });
  authSession.logout();
  storage.setTokens({ access: "access-b", refresh: "refresh-b" });
  authStore.getState().setUser({ id: 8 });
  reject(new Error("Offline"));
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(storage.getRefreshToken(), "refresh-b");
  assert.equal(authStore.getState().user.id, 8);
});

test("logout with no refresh token still clears the account without a request", () => {
  storage.clearTokens();
  authClient.post = () => { throw new Error("Unexpected request"); };
  authSession.logout();
  assert.equal(authStore.getState().user, null);
});

test("a refresh response arriving after logout cannot restore authentication", async () => {
  let resolve;
  authClient.post = (url) => url === "/auth/logout/"
    ? Promise.resolve({ status: 205 })
    : new Promise((finish) => { resolve = finish; });
  const pending = refreshModule.refreshSession();
  authSession.logout();
  resolve({ data: { access: "obsolete-access", refresh: "obsolete-refresh" } });
  await assert.rejects(pending, { name: "STALE_AUTH_SESSION" });
  assert.equal(storage.getRefreshToken(), null);
  assert.equal(authStore.getState().user, null);
});

test("a new account can refresh independently while an old account request is pending", async () => {
  const resolvers = new Map();
  authClient.post = (_, { refresh }) => new Promise((resolve) => { resolvers.set(refresh, resolve); });
  const old = refreshModule.refreshSession();
  storage.setTokens({ access: "access-b", refresh: "refresh-b" });
  const current = refreshModule.refreshSession();
  resolvers.get("refresh-b")({ data: { access: "new-access-b", refresh: "new-refresh-b" } });
  assert.equal(await current, "new-access-b");
  resolvers.get("refresh-a")({ data: { access: "obsolete-access-a", refresh: "obsolete-refresh-a" } });
  await assert.rejects(old, { name: "STALE_AUTH_SESSION" });
  assert.equal(storage.getRefreshToken(), "new-refresh-b");
});

for (const status of [400, 429, 503]) {
  test(`web API refresh HTTP ${status} preserves credentials for retry`, async () => {
    apiClient.defaults.adapter = async (config) => {
      throw new AxiosError("Expired", "ERR_BAD_REQUEST", config, null, {
        status: 401, data: {}, headers: {}, config,
      });
    };
    const failure = new AxiosError("Unavailable");
    failure.response = { status, data: {} };
    authClient.post = async () => { throw failure; };
    await assert.rejects(apiClient.get("/users/me/"), (error) => error === failure);
    assert.equal(storage.getRefreshToken(), "refresh-a");
    assert.equal(authStore.getState().user.id, 7);
    apiClient.defaults.adapter = originalAdapter;
  });
}

test("a delayed concurrent 401 reuses the current session's rotated access token", async () => {
  let releaseSecond;
  let refreshCalls = 0;
  const secondGate = new Promise((resolve) => { releaseSecond = resolve; });
  apiClient.defaults.adapter = async (config) => {
    if (config.headers.Authorization === "Bearer access-a") {
      if (config.url === "/second/") await secondGate;
      throw new AxiosError("Expired", "ERR_BAD_REQUEST", config, null, {
        status: 401, data: {}, headers: {}, config,
      });
    }
    assert.equal(config.headers.Authorization, "Bearer rotated-access");
    return { status: 200, data: {}, headers: {}, config };
  };
  authClient.post = async () => {
    refreshCalls += 1;
    return { data: { access: "rotated-access", refresh: "rotated-refresh" } };
  };
  const first = apiClient.get("/first/");
  const second = apiClient.get("/second/");
  await first;
  releaseSecond();
  await second;
  assert.equal(refreshCalls, 1);
  assert.equal(authStore.getState().user.id, 7);
  apiClient.defaults.adapter = originalAdapter;
});

test("concurrent expired requests share one rotating refresh", async () => {
  let calls = 0;
  apiClient.defaults.adapter = async (config) => {
    if (!config._retry) {
      throw new AxiosError("Expired", "ERR_BAD_REQUEST", config, null, {
        status: 401, data: {}, headers: {}, config,
      });
    }
    return { status: 200, data: {}, headers: {}, config };
  };
  authClient.post = async () => {
    calls += 1;
    return { data: { access: "rotated-access", refresh: "rotated-refresh" } };
  };

  await Promise.all([apiClient.get("/first/"), apiClient.get("/second/")]);

  assert.equal(calls, 1);
  assert.equal(storage.getRefreshToken(), "rotated-refresh");
});

test("a refresh failure continuation cannot clear a login established by another refresh caller", async () => {
  let rejectRefresh;
  let refreshStarted;
  const started = new Promise((resolve) => { refreshStarted = resolve; });
  authClient.post = () => new Promise((_, reject) => {
    rejectRefresh = reject;
  });
  const first = refreshModule.refreshSession();
  const firstHandled = first.catch(() => {
    storage.setTokens({ access: "access-b", refresh: "refresh-b" });
    authStore.getState().setUser({ id: 8 });
  });
  apiClient.defaults.adapter = async (config) => {
    refreshStarted();
    throw new AxiosError("Expired", "ERR_BAD_REQUEST", config, null, {
      status: 401, data: {}, headers: {}, config,
    });
  };
  const pending = apiClient.get("/users/me/");
  const rejected = assert.rejects(pending, { name: "STALE_AUTH_SESSION" });
  await started;
  await Promise.resolve();
  const failure = new AxiosError("Refresh rejected");
  failure.response = { status: 401, data: {} };
  rejectRefresh(failure);

  await firstHandled;
  await rejected;

  assert.equal(storage.getRefreshToken(), "refresh-b");
  assert.equal(authStore.getState().user.id, 8);
  assert.deepEqual(redirects, []);
});

for (const failure of ["network", "timeout", "cancel", "malformed"]) {
  test(`refresh ${failure} preserves the current session`, async () => {
    apiClient.defaults.adapter = async (config) => {
      throw new AxiosError("Expired", "ERR_BAD_REQUEST", config, null, {
        status: 401, data: {}, headers: {}, config,
      });
    };
    authClient.post = async () => {
      if (failure === "malformed") {
        return { data: {} };
      }
      if (failure === "cancel") {
        throw new CanceledError();
      }
      throw new AxiosError(
        "Unavailable",
        failure === "timeout" ? "ECONNABORTED" : "ERR_NETWORK",
      );
    };

    await assert.rejects(apiClient.get("/users/me/"));

    assert.equal(storage.getRefreshToken(), "refresh-a");
    assert.equal(authStore.getState().user.id, 7);
    assert.deepEqual(redirects, []);
  });
}

for (const missing of [false, true]) {
  test(`a ${missing ? "missing" : "rejected"} refresh still expires the session`, async () => {
    if (missing) {
      localStorage.removeItem("refresh_token");
    }
    apiClient.defaults.adapter = async (config) => {
      throw new AxiosError("Expired", "ERR_BAD_REQUEST", config, null, {
        status: 401, data: {}, headers: {}, config,
      });
    };
    authClient.post = async () => {
      const failure = new AxiosError("Refresh rejected");
      failure.response = { status: 401, data: {} };
      throw failure;
    };

    await assert.rejects(apiClient.get("/users/me/"));

    assert.equal(storage.getRefreshToken(), null);
    assert.equal(authStore.getState().isAuthenticated, false);
    assert.equal(storage.getSessionExpired(), true);
    assert.deepEqual(redirects, ["/login"]);
  });
}

test("auth transport cancellation is preserved without a synthetic network response", async () => {
  const canceled = new CanceledError();
  await assert.rejects(authClient.get("/auth/refresh/", {
    adapter: async () => { throw canceled; },
  }), (error) => error === canceled);
  assert.equal(canceled.response, undefined);
});

test("an obsolete login me request rejects instead of reporting a successful session", async () => {
  let finish;
  let started;
  const requestStarted = new Promise((resolve) => { started = resolve; });
  apiClient.defaults.adapter = (config) => new Promise((resolve) => {
    finish = () => resolve({
      status: 200, data: { data: { id: 7 } }, headers: {}, config,
    });
    started();
  });
  const pending = authSession.establishSession({ access: "login-a", refresh: "login-refresh-a" });
  const rejected = assert.rejects(pending, { name: "STALE_AUTH_SESSION" });
  await requestStarted;
  storage.setTokens({ access: "access-b", refresh: "refresh-b" });
  authStore.getState().setUser({ id: 8 });
  finish();
  await rejected;

  assert.equal(authStore.getState().user.id, 8);
  assert.equal(storage.getRefreshToken(), "refresh-b");
});

test("a failed old request cannot refresh or clear a newer login", async () => {
  let fail;
  let started;
  const requestStarted = new Promise((resolve) => { started = resolve; });
  apiClient.defaults.adapter = (config) => new Promise((_, reject) => {
    fail = () => reject(new AxiosError("Expired", "ERR_BAD_REQUEST", config, null, {
      status: 401, data: {}, headers: {}, config,
    }));
    started();
  });
  authClient.post = () => { throw new Error("Should not refresh the newer account"); };
  const pending = apiClient.get("/users/me/");
  await requestStarted;
  storage.setTokens({ access: "access-b", refresh: "refresh-b" });
  authStore.getState().setUser({ id: 8 });
  fail();
  await assert.rejects(pending, { name: "CanceledError" });
  assert.equal(storage.getRefreshToken(), "refresh-b");
  assert.equal(authStore.getState().user.id, 8);
  apiClient.defaults.adapter = originalAdapter;
});
