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
let authState;
let sessionRestoration;
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
    localStorage: dom.window.localStorage,
    requestAnimationFrame: (callback) => setTimeout(callback, 0),
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  dom.window.scrollTo = () => {};
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
          return `export let restorationStarts = 0;
            export function useRestoreSession() { restorationStarts += 1; }`;
        }
        if (path.endsWith("/auth.store.js")) {
          return `let state;
            export function setAuthState(value) { state = value; }
            export function useAuthStore(select = (value) => value) { return select(state); }`;
        }
        if (path.endsWith("/AdminPanelLayout.jsx")) {
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
  authState = await server.ssrLoadModule("/src/features/auth/storage/auth.store.js");
  sessionRestoration = await server.ssrLoadModule("/src/features/auth/hooks/useRestoreSession.js");
  ({ default: navigation } = await server.ssrLoadModule(
    "/src/features/admin-panel/config/sidebarNavigation.js",
  ));
  ({ PAGE_METADATA: metadata } = await server.ssrLoadModule(
    "/src/features/admin-panel/constants/pageMetaData.js",
  ));
});
beforeEach(async () => {
  authState.setAuthState({
    isLoading: false,
    isAuthenticated: true,
    user: { role: "admin" },
  });
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
  for (const key of [
    "window",
    "document",
    "HTMLElement",
    "localStorage",
    "requestAnimationFrame",
    "IS_REACT_ACT_ENVIRONMENT",
  ]) {
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

const legalDestinations = [
  ["/privacy-policy", "Privacy Policy"],
  ["/terms-of-service", "Terms of Service"],
  ["/data-deletion", "Data Deletion Instructions"],
];

for (const [path, title] of legalDestinations) {
  test(`${path} renders independently of session restoration`, async () => {
    authState.setAuthState({
      isLoading: true,
      isAuthenticated: false,
      user: null,
    });
    const initialRestorationStarts = sessionRestoration.restorationStarts;

    await render(path);

    assert.equal(container.querySelector("main h1")?.textContent, title);
    assert.equal(document.title, `${title} | SugboGo`);
    assert.equal(sessionRestoration.restorationStarts, initialRestorationStarts);
    const supportLinks = container.querySelectorAll("main a[href^='mailto:']");
    assert.equal(supportLinks.length, 1);
    assert.equal(supportLinks[0].textContent, "support.sugbogo@gmail.com");
    assert.equal(supportLinks[0].getAttribute("href"), "mailto:support.sugbogo@gmail.com");
    assert.equal(container.querySelector("footer [aria-current='page']")?.getAttribute("href"), path);
    assert.deepEqual(
      [...container.querySelectorAll("footer nav a")].map((link) => link.getAttribute("href")),
      legalDestinations.map(([destination]) => destination),
    );
  });
}

test("footer links navigate between legal pages and focus the main content", async () => {
  authState.setAuthState({
    isLoading: false,
    isAuthenticated: false,
    user: null,
  });
  await render("/privacy-policy");

  await act(async () => {
    container.querySelector("footer a[href='/data-deletion']").dispatchEvent(
      new window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
    );
  });

  assert.equal(container.querySelector("main h1")?.textContent, "Data Deletion Instructions");
  assert.equal(document.activeElement, container.querySelector("main"));
});

for (const user of [null, { role: "explorer" }]) {
  test(`admin dashboard redirects ${user?.role ?? "signed-out visitors"} to Login`, async () => {
    authState.setAuthState({
      isLoading: false,
      isAuthenticated: Boolean(user),
      user,
    });

    await render("/admin-panel/dashboard");

    assert.equal(container.textContent, "LoginPage.jsx");
  });
}

for (const path of ["/", "/login"]) {
  test(`${path} retains the public Admin Login destination`, async () => {
    authState.setAuthState({
      isLoading: false,
      isAuthenticated: false,
      user: null,
    });

    await render(path);

    assert.equal(container.textContent, "LoginPage.jsx");
  });
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
