import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React, { act } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { createServer } from "vite";

const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
let server;
let dom;
let root;
let container;
let SidebarLink;
let navigation;
const pages = {};
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
      name: "navigation-page-dependencies",
      enforce: "pre",
      load(id) {
        const path = id.replaceAll("\\", "/");
        if (path.endsWith("/useBusinessApplicationStatistics.js")) {
          return "export default function useStatistics() { return { isLoading: true }; }";
        }
        if (path.endsWith("/useBusinessApplicationTableState.js")) {
          return "export default function useTable() { return {}; }";
        }
        if (/\/business(es|-applications)\/components\//.test(path)) {
          return "export default function Component() { return null; }";
        }
      },
    }],
  });
  const base = "/src/features/admin-panel/";
  for (const name of ["BusinessesPage", "BusinessApplicationsPage"]) {
    ({ default: pages[name] } = await server.ssrLoadModule(`${base}pages/${name}.jsx`));
  }
  ({ default: SidebarLink } = await server.ssrLoadModule(`${base}components/sidebar/SidebarLink.jsx`));
  ({ default: navigation } = await server.ssrLoadModule(`${base}config/sidebarNavigation.js`));
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
async function render(children, path) {
  await act(async () => root.render(React.createElement(
    MemoryRouter,
    { initialEntries: [path] },
    children,
  )));
}
for (const [name, path] of [
  ["BusinessesPage", "/admin-panel/businesses"],
  ["BusinessApplicationsPage", "/admin-panel/businesses/applications"],
]) {
  test(`${name}: breadcrumb links to dashboard and organizational labels remain text`, async () => {
    await render(React.createElement(Routes, null,
      React.createElement(Route, { path, element: React.createElement(pages[name]) }),
      React.createElement(Route, {
        path: "/admin-panel/dashboard",
        element: React.createElement("h1", null, "Dashboard destination"),
      }),
    ), path);
    const breadcrumb = container.querySelector("nav");
    const links = breadcrumb.querySelectorAll("a");
    assert.equal(links.length, 1);
    assert.equal(links[0].textContent, "SugboGo Admin");
    assert.equal(links[0].getAttribute("href"), "/admin-panel/dashboard");
    assert.equal([...breadcrumb.querySelectorAll("span")].some((node) => node.textContent === "Management"), true);
    await act(async () => links[0].dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })));
    assert.equal(container.querySelector("h1").textContent, "Dashboard destination");
  });
}
const updateRoot = "/admin-panel/businesses/update-requests";
for (const [suffix, active] of [
  ["", true],
  ["/42", true],
  ["/classification/42", true],
  ["/location/42", true],
  ["/classification", false],
  ["/location", false],
  ["/classification/not-an-id", false],
  ["/location/42/extra", false],
  ["/other/42", false],
]) {
  test(`Update Requests active state: ${suffix || "queue"}`, async () => {
    const items = navigation.flatMap((section) => section.items);
    await render(React.createElement(React.Fragment, null,
      ...items.map((item) => React.createElement(SidebarLink, { ...item, key: item.to })),
    ), `${updateRoot}${suffix}?status=pending`);
    const highlighted = [...container.querySelectorAll("a")]
      .filter((link) => link.classList.contains("bg-sidebar-active"));
    assert.deepEqual(highlighted.map((link) => link.getAttribute("href")), active ? [updateRoot] : []);
  });
}

