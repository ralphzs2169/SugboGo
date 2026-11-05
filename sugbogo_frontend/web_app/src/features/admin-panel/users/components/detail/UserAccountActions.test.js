import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer } from "vite";

let server;
let UserAccountActions;
let authStore;
let getUserColumns;

before(async () => {
  server = await createServer({
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
  });
  ({ default: UserAccountActions } = await server.ssrLoadModule(
    "/src/features/admin-panel/users/components/detail/UserAccountActions.jsx",
  ));
  ({ useAuthStore: authStore } = await server.ssrLoadModule(
    "/src/features/auth/storage/auth.store.js",
  ));
  ({ default: getUserColumns } = await server.ssrLoadModule(
    "/src/features/admin-panel/users/columns/userColumns.jsx",
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

test("detail invitation resend requires Super Admin authority and explicit eligibility", () => {
  const target = {
    id: 2,
    role: "admin",
    status: "pending",
    invitation_resend_eligible: true,
  };
  assert.match(renderActions({ id: 1, role: "super_admin" }, target), /Resend Invitation/);
  assert.doesNotMatch(renderActions({ id: 1, role: "admin" }, target), /Resend Invitation/);
  assert.doesNotMatch(
    renderActions({ id: 1, role: "super_admin" }, { ...target, invitation_resend_eligible: false }),
    /Resend Invitation/,
  );
  assert.doesNotMatch(
    renderActions({ id: 1, role: "super_admin" }, { ...target, status: "active" }),
    /Resend Invitation/,
  );
});

test("table columns preserve sorting contracts, page numbering, and PHT dates", () => {
  const columns = getUserColumns({ currentUser: { id: 1, role: "admin" } });
  assert.deepEqual(
    columns.map((column) => column.header),
    ["No.", "User", "Email", "Role", "Status", "Date Joined", "Actions"],
  );
  assert.equal(columns[0].enableSorting, false);
  assert.equal(columns.at(-1).enableSorting, false);
  assert.equal(columns[0].cell({
    row: { index: 2 },
    table: { getState: () => ({ pagination: { pageIndex: 2, pageSize: 25 } }) },
  }), 53);
  const joined = columns.find((column) => column.id === "joined_at");
  assert.match(
    renderToString(joined.cell({ getValue: () => "2026-11-04T16:30:00Z" })),
    /Nov 5, 2026/,
  );
});

test("table actions enforce protected accounts and backend resend eligibility", () => {
  function items(actor, target) {
    const column = getUserColumns({ currentUser: actor }).at(-1);
    return column.cell({ row: { original: target } }).props.items
      .map((item) => item.key)
      .filter(Boolean);
  }

  const admin = { id: 1, role: "admin" };
  const superAdmin = { id: 1, role: "super_admin" };
  const target = { id: 2, role: "explorer", status: "disabled" };
  assert.deepEqual(items(admin, target), ["view", "reactivate"]);
  assert.deepEqual(items(admin, { ...target, id: 1 }), ["view"]);
  assert.deepEqual(items(admin, { ...target, role: "admin" }), ["view"]);
  assert.deepEqual(items(superAdmin, { ...target, role: "admin" }), ["view", "reactivate"]);
  assert.deepEqual(items(superAdmin, { ...target, role: "super_admin" }), ["view"]);

  const invitation = {
    id: 3,
    role: "admin",
    status: "pending",
    invitation_resend_eligible: true,
  };
  assert.deepEqual(items(superAdmin, invitation), ["view", "resend-invitation"]);
  assert.deepEqual(items(admin, invitation), ["view"]);
  assert.deepEqual(
    items(superAdmin, { ...invitation, invitation_resend_eligible: false }),
    ["view"],
  );
});
