import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer } from "vite";

let server;
let UserAccountActions;
let authStore;

before(async () => {
  server = await createServer({ appType: "custom", server: { middlewareMode: true } });
  ({ default: UserAccountActions } = await server.ssrLoadModule(
    "/src/features/admin-panel/users/components/detail/UserAccountActions.jsx",
  ));
  ({ useAuthStore: authStore } = await server.ssrLoadModule(
    "/src/features/auth/storage/auth.store.js",
  ));
});

after(async () => { await server?.close(); });

function renderActions(actor, target) {
  const initialState = authStore.getInitialState();
  const previousUser = initialState.user;
  const client = new QueryClient();
  // Server rendering reads Zustand's initial snapshot rather than live state.
  initialState.user = actor;
  try {
    return renderToString(React.createElement(QueryClientProvider, { client },
      React.createElement(UserAccountActions, { user: target }),
    ));
  } finally {
    initialState.user = previousUser;
    client.clear();
  }
}

test("an authorized admin can restore disabled Explorer and Merchant accounts", () => {
  for (const role of ["explorer", "merchant"]) {
    const html = renderActions({ id: 1, role: "admin" }, { id: 2, role, status: "disabled" });
    assert.match(html, /Reactivate User/);
    assert.doesNotMatch(html, /Suspend User/);
  }
});

test("disabled accounts retain the existing admin-to-target authority rules", () => {
  const target = { id: 2, role: "admin", status: "disabled" };
  assert.doesNotMatch(renderActions({ id: 1, role: "admin" }, target), /Reactivate User/);
  assert.match(renderActions({ id: 1, role: "super_admin" }, target), /Reactivate User/);
  assert.doesNotMatch(renderActions({ id: 2, role: "super_admin" }, target), /Reactivate User/);
  assert.doesNotMatch(renderActions({ id: 1, role: "explorer" }, { ...target, role: "explorer" }), /Reactivate User/);
});

test("suspension and reactivation remain available for their existing eligible states", () => {
  const actor = { id: 1, role: "admin" };
  const target = { id: 2, role: "explorer" };
  assert.match(renderActions(actor, { ...target, status: "active" }), /Suspend User/);
  assert.match(renderActions(actor, { ...target, status: "suspended" }), /Reactivate User/);
  assert.doesNotMatch(renderActions(actor, { ...target, status: "pending" }), /Reactivate User|Suspend User/);
});
