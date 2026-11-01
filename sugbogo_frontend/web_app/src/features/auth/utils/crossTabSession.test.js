import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React, { act } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { createServer } from "vite";

const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
const previousGlobals = new Map(
  ["window", "document", "localStorage", "HTMLElement", "IS_REACT_ACT_ENVIRONMENT"]
    .map((key) => [key, globalThis[key]]),
);
let server;
let dom;
let root;
let container;
let createRoot;
let storage;
let auth;
let client;
let api;
let authClient;
let refresh;
let useRestoreSession;
let ProtectedRoute;
let user;
let transport;
const key = ["admin", "dashboard", "summary"];

before(async () => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost",
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  ({ createRoot } = await import("react-dom/client"));
  server = await createServer({
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
  });
  storage = await server.ssrLoadModule("/src/shared/api/storage.js");
  ({ useAuthStore: auth } = await server.ssrLoadModule("/src/features/auth/storage/auth.store.js"));
  ({ default: client } = await server.ssrLoadModule("/src/lib/queryClient.js"));
  ({ default: api } = await server.ssrLoadModule("/src/shared/api/apiClient.js"));
  ({ default: authClient } = await server.ssrLoadModule("/src/shared/api/authClient.js"));
  refresh = await server.ssrLoadModule("/src/shared/api/refresh.js");
  ({ useRestoreSession } = await server.ssrLoadModule("/src/features/auth/hooks/useRestoreSession.js"));
  ({ default: ProtectedRoute } = await server.ssrLoadModule("/src/features/auth/routes/ProtectedRoute.jsx"));
});

beforeEach(() => {
  storage.setTokens({ access: "account-a", refresh: "refresh-a" });
  auth.getState().setLoading(true);
  user = { id: 1, role: "super_admin" };
  transport = async () => ({ data: { data: user } });
  api.defaults.adapter = async (config) => ({
    status: 200,
    statusText: "OK",
    headers: {},
    ...await transport(config),
    config,
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  storage.clearTokens();
});

after(async () => {
  await server?.close();
  dom.window.close();
  for (const [name, value] of previousGlobals) {
    if (value === undefined) delete globalThis[name];
    else globalThis[name] = value;
  }
});

function SessionProbe() {
  useRestoreSession();
  return React.createElement(MemoryRouter, { initialEntries: ["/admin"] },
    React.createElement(Routes, null,
      React.createElement(Route, { element: React.createElement(ProtectedRoute) },
        React.createElement(Route, {
          path: "/admin",
          element: React.createElement("p", null, "Protected administration"),
        }),
      ),
      React.createElement(Route, {
        path: "/login",
        element: React.createElement("p", null, "Sign in"),
      }),
    ),
  );
}

async function mountSession() {
  await act(async () => root.render(React.createElement(SessionProbe)));
  assert.match(container.textContent, /Protected administration/);
}

function storageEvent() {
  window.dispatchEvent(new window.StorageEvent("storage", {
    key: "auth_session_id",
    storageArea: localStorage,
  }));
}

function externalLogin(role = "admin") {
  user = { id: 2, role };
  localStorage.setItem("access_token", "account-b");
  localStorage.setItem("refresh_token", "refresh-b");
  localStorage.setItem("auth_session_id", "external-owner-b");
  storageEvent();
}

test("external logout immediately clears caches, cancels protected reads, and closes the route", async () => {
  await mountSession();
  client.setQueryData(key, { account: "A" });
  let signal;
  let finish;
  transport = (config) => new Promise((resolveRequest) => {
    signal = config.signal;
    finish = () => resolveRequest({ data: { data: { account: "A" } } });
  });
  const pending = client.fetchQuery({ queryKey: [...key, "pending"], queryFn: () => api.get("/protected/") });
  const rejected = assert.rejects(pending);
  await Promise.resolve();
  await Promise.resolve();
  await act(async () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("auth_session_id");
    storageEvent();
  });
  assert.equal(signal.aborted, true);
  assert.equal(client.getQueryData(key), undefined);
  assert.equal(auth.getState().user, null);
  assert.match(container.textContent, /Sign in/);
  finish();
  await rejected;
  assert.equal(client.getQueryData([...key, "pending"]), undefined);
});

for (const role of ["admin", "super_admin", "merchant", "explorer"]) {
  test(`external account transition reconciles ${role} access without keeping the old account`, async () => {
    await mountSession();
    client.setQueryData(key, { account: "A" });
    const generation = storage.getSessionGeneration();
    await act(async () => externalLogin(role));
    assert.equal(client.getQueryData(key), undefined);
    assert.ok(storage.getSessionGeneration() > generation);
    assert.equal(auth.getState().user.id, 2);
    assert.match(container.textContent, /admin/.test(role) ? /Protected administration/ : /Sign in/);
    const reconciled = storage.getSessionGeneration();
    await act(async () => storageEvent());
    assert.equal(storage.getSessionGeneration(), reconciled);
  });
}

test("external token rotation retains session ownership, authentication, and cached queries", async () => {
  await mountSession();
  client.setQueryData(key, { account: "A" });
  const generation = storage.getSessionGeneration();
  await act(async () => {
    localStorage.setItem("access_token", "rotated-access");
    localStorage.setItem("refresh_token", "rotated-refresh");
    window.dispatchEvent(new window.StorageEvent("storage", { key: "access_token" }));
  });
  assert.equal(storage.getSessionGeneration(), generation);
  assert.equal(auth.getState().user.id, 1);
  assert.equal(client.getQueryData(key).account, "A");
});

test("an old refresh cannot overwrite an externally established session", async () => {
  await mountSession();
  let finish;
  authClient.post = () => new Promise((resolveRequest) => { finish = resolveRequest; });
  const pending = refresh.refreshSession();
  const rejected = assert.rejects(pending, { name: "STALE_AUTH_SESSION" });
  await act(async () => externalLogin());
  finish({ data: { access: "obsolete", refresh: "obsolete" } });
  await rejected;
  assert.equal(storage.getAccessToken(), "account-b");
  assert.equal(auth.getState().user.id, 2);
});

test("an obsolete user restoration cannot restore the prior administrator after a lower-role transition", async () => {
  let finishOld;
  transport = () => new Promise((resolveRequest) => { finishOld = resolveRequest; });
  await act(async () => root.render(React.createElement(SessionProbe)));
  transport = async () => ({ data: { data: { id: 2, role: "merchant" } } });
  await act(async () => externalLogin("merchant"));
  await act(async () => finishOld({ data: { data: { id: 1, role: "super_admin" } } }));
  assert.equal(auth.getState().user.id, 2);
  assert.match(container.textContent, /Sign in/);
});

test("a late successful response detects changed ownership before the storage event is delivered", async () => {
  await mountSession();
  client.setQueryData(key, { account: "A" });
  let finish;
  let started;
  const requestStarted = new Promise((resolveRequest) => { started = resolveRequest; });
  transport = () => new Promise((resolveRequest) => {
    finish = () => resolveRequest({ data: { data: { account: "A" } } });
    started();
  });
  const pending = api.get("/protected/");
  const rejected = assert.rejects(pending, { name: "STALE_AUTH_SESSION" });
  await requestStarted;
  localStorage.setItem("access_token", "account-b");
  localStorage.setItem("refresh_token", "refresh-b");
  localStorage.setItem("auth_session_id", "external-owner-b");
  transport = async () => ({ data: { data: { id: 2, role: "admin" } } });
  await act(async () => {
    finish();
    await rejected;
  });
  assert.equal(client.getQueryData(key), undefined);
  assert.equal(auth.getState().user.id, 2);
});
