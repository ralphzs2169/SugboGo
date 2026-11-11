import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React, { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
let server;
let dom;
let root;
let container;
let App;
let navigation;
let metadata;
const retiredPaths = [
  "/admin-panel/settings",
  "/admin-panel/users/roles-permissions",
  "/admin-panel/explorer-activity",
];

before(async () => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  server = await createServer({
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, ws: false },
    plugins: [{
      name: "admin-route-dependencies",
      enforce: "pre",
      load(id) {
        const path = id.replaceAll("\\", "/");
        if (path.endsWith("/useRestoreSession.js")) {
          return "export function useRestoreSession() {}";
        }
        if (path.endsWith("/auth.store.js")) {
          return "export const useAuthStore = (select) => select({ isLoading: false });";
        }
        if (path.endsWith("/ProtectedRoute.jsx") || path.endsWith("/AdminPanelLayout.jsx")) {
          return 'export { Outlet as default } from "react-router-dom";';
        }
        if (/\/features\/(admin-panel|auth)\/pages\/[^/]+\.jsx$/.test(path)) {
          const name = path.split("/").at(-1);
          return `import React from "react";
            export default function Page() { return React.createElement("p", null, ${JSON.stringify(name)}); }`;
        }
      },
    }],
  });
  ({ default: App } = await server.ssrLoadModule("/src/App.jsx"));
  ({ default: navigation } = await server.ssrLoadModule(
    "/src/features/admin-panel/config/sidebarNavigation.js",
  ));
  ({ PAGE_METADATA: metadata } = await server.ssrLoadModule(
    "/src/features/admin-panel/constants/pageMetaData.js",
  ));
});
beforeEach(async () => {
  container = document.createElement("div");
  document.body.append(container);
  const { createRoot } = await import("react-dom/client");
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
after(async () => {
  await server.close();
  dom.window.close();
  for (const key of ["window", "document", "HTMLElement", "IS_REACT_ACT_ENVIRONMENT"]) {
    delete globalThis[key];
  }
});
async function render(path) {
  await act(async () => root.render(React.createElement(
    MemoryRouter,
    { initialEntries: [path] },
    React.createElement(App),
  )));
}
for (const path of retiredPaths) {
  test(`${path} resolves to the existing Not Found page`, async () => {
    await render(`${path}?from=bookmark`);
    assert.equal(container.querySelector("h1")?.textContent, "404");
    assert.match(container.textContent, /Page not found/);
    assert.doesNotMatch(container.textContent, /UserDetailPage/);
  });
}
for (const [path, page] of [
  ["/admin-panel/dashboard", "Dashboard.jsx"],
  ["/admin-panel/users/all", "Users.jsx"],
  ["/admin-panel/users/42", "UserDetailPage.jsx"],
]) {
  test(`${path} retains its existing destination`, async () => {
    await render(path);
    assert.match(container.textContent, new RegExp(page));
    assert.doesNotMatch(container.textContent, /Page not found/);
  });
}
test("sidebar destinations and page metadata exclude retired pages", () => {
  const destinations = navigation.flatMap((section) => section.items)
    .flatMap((item) => [item.to, ...(item.items ?? []).map((child) => child.to)]);
  for (const path of retiredPaths) {
    assert.equal(destinations.includes(path), false);
    assert.equal(Object.hasOwn(metadata, path), false);
  }
  assert.ok(destinations.includes("/admin-panel/activity-logs"));
  assert.ok(destinations.includes("/admin-panel/explore-configuration"));
});
