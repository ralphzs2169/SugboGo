import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, mock, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React, { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";
import toast from "react-hot-toast";

const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
const cluster = { id: 1, name: "Food", icon: "utensils", category_count: 0, business_count: 0 };
const category = { id: 1, name: "Dining", cluster_id: 1, business_count: 0, application_count: 0 };
const shortcut = { id: 1, cluster, title: "Find food", subtitle: "Places to eat", is_active: true };
const specialtyTag = { id: 1, name: "Heritage", icon: "tag", color: "blue", application_count: 0 };
const forms = [
  { file: "cluster-category/components/CreateClusterModal.jsx", field: "name", props: {} },
  { file: "cluster-category/components/EditClusterModal.jsx", field: "name", props: { cluster } },
  { file: "cluster-category/components/CreateCategoryModal.jsx", field: "name", selectCluster: true, props: {} },
  { file: "cluster-category/components/EditCategoryModal.jsx", field: "name", props: { category } },
  { file: "cluster-category/components/CreateDiscoveryShortcutModal.jsx", field: "title", selectCluster: true, props: { shortcuts: [] } },
  { file: "cluster-category/components/EditDiscoveryShortcutModal.jsx", field: "title", props: { shortcut } },
  { file: "specialty-tags/components/CreateSpecialtyTagModal.jsx", field: "name", props: {} },
  { file: "specialty-tags/components/EditSpecialtyTagModal.jsx", field: "name", props: { specialtyTag } },
];
let dom;
let server;
let root;
let container;
let client;
let Modal;
let Table;
let SpecialtyPanel;
let TransferDecision;
let writes;
let reads;
let mutation;
let readGate;

function deferred() {
  let resolvePromise;
  let rejectPromise;
  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

before(async () => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost",
    pretendToBeVisual: true,
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    Event: dom.window.Event,
    CustomEvent: dom.window.CustomEvent,
    MouseEvent: dom.window.MouseEvent,
    MutationObserver: dom.window.MutationObserver,
    getComputedStyle: dom.window.getComputedStyle,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  server = await createServer({
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, ws: false },
    plugins: [{
      name: "modal-safety-transport",
      enforce: "pre",
      load(id) {
        if (id.replaceAll("\\", "/").endsWith("/shared/api/apiClient.js")) {
          return `export default {
            get: (...args) => globalThis.__modalSafetyTransport("get", ...args),
            post: (...args) => globalThis.__modalSafetyTransport("post", ...args),
            patch: (...args) => globalThis.__modalSafetyTransport("patch", ...args),
            delete: (...args) => globalThis.__modalSafetyTransport("delete", ...args),
          };`;
        }
      },
    }],
  });
  for (const form of forms) {
    ({ default: form.Component } = await server.ssrLoadModule(`/src/features/admin-panel/${form.file}`));
  }
  ({ default: Modal } = await server.ssrLoadModule("/src/shared/components/modals/Modal.jsx"));
  ({ default: Table } = await server.ssrLoadModule("/src/features/admin-panel/cluster-category/components/ClusterCategoryManagementTable.jsx"));
  ({ default: SpecialtyPanel } = await server.ssrLoadModule("/src/features/admin-panel/specialty-tags/components/SpecialtyTagManagementPanel.jsx"));
  ({ default: TransferDecision } = await server.ssrLoadModule("/src/features/admin-panel/transit-network/components/transfers/TransferDecisionModal.jsx"));
});

beforeEach(async () => {
  writes = [];
  reads = [];
  readGate = null;
  mutation = async () => ({ id: 1 });
  mock.method(toast, "error", () => {});
  mock.method(toast, "success", () => {});
  mock.method(console, "error", () => {});
  globalThis.__modalSafetyTransport = async (method, url, payload = {}) => {
    if (method !== "get") {
      writes.push({ method, url, payload });
      return { data: { data: await mutation(method, url, payload) } };
    }
    reads.push(url);
    if (readGate) await readGate.promise;
    const resource = url.split("/")[3];
    const records = {
      clusters: [cluster, { ...cluster, id: 2, name: "Arts" }],
      categories: [category],
      "discovery-shortcuts": [shortcut],
      "specialty-tags": [specialtyTag],
    };
    assert.ok(records[resource], `Unexpected endpoint ${url}`);
    return { data: { data: {
      items: records[resource],
      pagination: { total_items: records[resource].length, total_pages: 1 },
    } } };
  };
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  container = document.createElement("div");
  document.body.append(container);
  const { createRoot } = await import("react-dom/client");
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
  assert.equal(document.querySelector('[role="listbox"]'), null);
  assert.equal(document.body.style.overflow, "");
  mock.restoreAll();
});

after(async () => {
  await server?.close();
  dom.window.close();
  for (const key of [
    "window", "document", "HTMLElement", "Element", "Node", "MutationObserver",
    "Event", "CustomEvent", "MouseEvent",
    "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame",
    "IS_REACT_ACT_ENVIRONMENT", "__modalSafetyTransport",
  ]) delete globalThis[key];
});

async function render(Component, props = {}) {
  await act(async () => root.render(
    React.createElement(QueryClientProvider, { client },
      React.createElement(MemoryRouter, null, React.createElement(Component, props)),
    ),
  ));
}

async function until(predicate) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await act(async () => new Promise((done) => setTimeout(done, 10)));
  }
  assert.fail("Modal did not reach the expected state");
}

const dialog = () => container.querySelector('[role="dialog"]');
const button = (label, scope = container) => [...scope.querySelectorAll("button")].find(
  (item) => item.textContent.trim() === label || item.getAttribute("aria-label") === label,
);

async function input(element, value) {
  const prototype = element.tagName === "TEXTAREA"
    ? dom.window.HTMLTextAreaElement.prototype
    : dom.window.HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value);
    element.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
}

async function escape(target = dialog()) {
  const event = new dom.window.KeyboardEvent("keydown", {
    key: "Escape", bubbles: true, cancelable: true,
  });
  await act(async () => target.dispatchEvent(event));
  return event;
}

async function attemptDismissal() {
  assert.ok(dialog());
  assert.equal(button("Close modal", dialog()).disabled, true);
  const cancel = button("Cancel", dialog());
  if (cancel) assert.equal(cancel.disabled, true);
  await escape();
  await act(async () => {
    dialog().parentElement.click();
    button("Close modal", dialog()).click();
    cancel?.click();
  });
  assert.ok(dialog());
}

function submitRepeatedly() {
  const form = dialog().querySelector("form");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  }
}

async function fillForm(form) {
  await input(dialog().querySelector(`[name="${form.field}"]`), "Updated value");
  const subtitle = dialog().querySelector('[name="subtitle"]');
  if (subtitle) await input(subtitle, "Useful subtitle");
  if (form.selectCluster) {
    await until(() => !dialog().querySelector('[aria-haspopup="listbox"]').disabled);
    await act(async () => dialog().querySelector('[aria-haspopup="listbox"]').click());
    await act(async () => document.querySelector('[role="option"]').click());
  }
}

for (const form of forms) {
  test(`${form.file}: locks pending submissions, restores failure dismissal, and awaits completion`, async () => {
    let closed = 0;
    let refreshed = 0;
    let operation = deferred();
    const refresh = deferred();
    mutation = () => operation.promise;
    await render(form.Component, {
      ...form.props,
      isOpen: true,
      onClose: () => { closed += 1; },
      onSuccess: async () => { refreshed += 1; await refresh.promise; },
    });
    await until(() => client.isFetching() === 0);
    await fillForm(form);
    await act(async () => submitRepeatedly());
    assert.equal(writes.length, 1);
    await attemptDismissal();
    assert.equal(closed, 0);
    assert.ok(dialog().querySelector('button[type="submit"]').disabled);
    assert.ok(dialog().querySelector(".lucide-loader-circle"));

    await act(async () => operation.reject({ response: { data: { message: "Mutation rejected." } } }));
    await until(() => !button("Close modal", dialog()).disabled);
    assert.equal(toast.error.mock.calls.at(-1).arguments[0], "Mutation rejected.");
    await escape();
    assert.equal(closed, 1);
    closed = 0;
    operation = deferred();
    await fillForm(form);
    await act(async () => submitRepeatedly());
    assert.equal(writes.length, 2);
    await act(async () => operation.resolve({ id: 1 }));
    await until(() => refreshed === 1);
    await attemptDismissal();
    assert.equal(closed, 0);
    await act(async () => refresh.resolve());
    await until(() => closed === 1);
  });
}

for (const resource of ["clusters", "categories", "discovery-shortcuts", "specialty-tags"]) {
  test(`${resource}: delete remains locked through refresh and preserves failure/success feedback`, async () => {
    let operation = deferred();
    mutation = () => operation.promise;
    await render(resource === "specialty-tags" ? SpecialtyPanel : Table, { resource });
    const label = { clusters: "Food", categories: "Dining", "discovery-shortcuts": "Find food", "specialty-tags": "Heritage" }[resource];
    await until(() => button(`Delete ${label}`));
    await act(async () => button(`Delete ${label}`).click());
    const remove = button("Delete", dialog());
    await act(async () => { remove.click(); remove.click(); remove.click(); });
    assert.equal(writes.length, 1);
    assert.match(writes[0].url, new RegExp(`${resource}/1/$`));
    await attemptDismissal();
    await act(async () => operation.reject({ response: { data: { message: "Deletion rejected." } } }));
    await until(() => !button("Cancel", dialog()).disabled);
    assert.equal(toast.error.mock.calls.at(-1).arguments[0], "Deletion rejected.");
    operation = deferred();
    await act(async () => button("Delete", dialog()).click());
    const refresh = deferred();
    readGate = refresh;
    const previousReads = reads.length;
    await act(async () => operation.resolve({}));
    await until(() => reads.length > previousReads);
    await attemptDismissal();
    readGate = null;
    await act(async () => refresh.resolve());
    await until(() => !dialog());
    assert.match(toast.success.mock.calls.at(-1).arguments[0], /deleted successfully/);
  });
}

test("a submitted deletion cannot close a newer target or release its pending state", async () => {
  const first = deferred();
  const second = deferred();
  mutation = (method, url) => url.endsWith("/1/") ? first.promise : second.promise;
  await render(Table, { resource: "clusters" });
  await until(() => button("Delete Food"));
  await act(async () => button("Delete Food").click());
  await act(async () => button("Delete", dialog()).click());
  // Force a replacement as an external owner change; normal pointer interaction is blocked by the overlay.
  await act(async () => button("Delete Arts").click());
  await act(async () => button("Delete", dialog()).click());
  assert.deepEqual(writes.map((write) => write.url), ["/admin/taxonomy/clusters/1/", "/admin/taxonomy/clusters/2/"]);
  await act(async () => first.resolve({}));
  await until(() => toast.success.mock.calls.length === 1);
  assert.match(dialog().textContent, /Arts/);
  await attemptDismissal();
  await act(async () => second.resolve({}));
  await until(() => !dialog());
});

for (const outcome of ["success", "failure"]) {
  test(`an old form ${outcome} cannot change a newer form after its target changes`, async () => {
    const Component = forms[3].Component;
    const first = deferred();
    const second = deferred();
    const firstRefresh = deferred();
    let closed = 0;
    let refreshed = 0;
    mutation = (method, url) => url.endsWith("/1/") ? first.promise : second.promise;
    await render(Component, {
      isOpen: true, category, onClose: () => { closed += 1; },
      onSuccess: async () => { refreshed += 1; await firstRefresh.promise; },
    });
    await until(() => client.isFetching() === 0);
    await fillForm(forms[3]);
    await act(async () => submitRepeatedly());
    if (outcome === "success") {
      await act(async () => first.resolve({}));
      await until(() => refreshed === 1);
    }
    await render(Component, {
      isOpen: true, category: { ...category, id: 2, name: "New target" },
      onClose: () => { closed += 1; }, onSuccess: async () => {},
    });
    await input(dialog().querySelector('[name="name"]'), "New draft");
    await act(async () => submitRepeatedly());
    await act(async () => {
      if (outcome === "success") firstRefresh.resolve();
      else first.reject({ response: { data: { errors: { name: "Old field error" }, message: "Old failure" } } });
    });
    assert.equal(closed, 0);
    assert.equal(dialog().querySelector('[name="name"]').value, "New draft");
    assert.doesNotMatch(dialog().textContent, /Old field error/);
    await attemptDismissal();
    await act(async () => second.resolve({}));
    await until(() => closed === 1);
  });
}

for (const action of ["confirm", "ignore"]) {
  test(`transfer ${action}: prevents dismissal and duplicates, and recovers from failure`, async () => {
    let closed = 0;
    let saved = 0;
    let operation = deferred();
    mutation = () => operation.promise;
    await render(TransferDecision, {
      transfer: { id: 4 }, action,
      onClose: () => { closed += 1; }, onSaved: () => { saved += 1; },
    });
    const label = action === "confirm" ? "Confirm Transfer" : "Ignore Transfer";
    const confirm = button(label, dialog());
    await act(async () => { confirm.click(); confirm.click(); confirm.click(); });
    assert.equal(writes.length, 1);
    await attemptDismissal();
    assert.equal(closed, 0);
    await act(async () => operation.reject({ response: { data: { message: "Transfer rejected." } } }));
    await until(() => !button("Cancel", dialog()).disabled);
    assert.equal(toast.error.mock.calls.at(-1).arguments[0], "Transfer rejected.");
    operation = deferred();
    await act(async () => button(label, dialog()).click());
    await act(async () => operation.resolve({ id: 4 }));
    await until(() => saved === 1);
    assert.match(toast.success.mock.calls.at(-1).arguments[0], /successfully/);
  });
}

test("cluster dropdown consumes Escape before its parent and preserves form values and selection", async () => {
  let closed = 0;
  await render(forms[2].Component, { isOpen: true, onClose: () => { closed += 1; } });
  await until(() => client.isFetching() === 0);
  await input(dialog().querySelector('[name="name"]'), "Saved local draft");
  const trigger = dialog().querySelector('[aria-haspopup="listbox"]');
  await act(async () => { trigger.focus(); trigger.click(); });
  assert.ok(document.querySelector('[role="listbox"]'));
  const firstEscape = await escape(trigger);
  assert.equal(firstEscape.defaultPrevented, true);
  assert.equal(document.querySelector('[role="listbox"]'), null);
  assert.equal(closed, 0);
  assert.equal(dialog().querySelector('[name="name"]').value, "Saved local draft");
  assert.equal(document.activeElement, trigger);
  await act(async () => trigger.click());
  const option = document.querySelector('[role="option"]');
  await act(async () => option.focus());
  await escape(option);
  assert.equal(closed, 0);
  assert.equal(document.activeElement, trigger);
  await act(async () => trigger.click());
  await act(async () => document.querySelector('[role="option"]').click());
  assert.equal(trigger.textContent.trim(), "Food");
  await act(async () => trigger.click());
  await act(async () => dialog().querySelector('[name="name"]').dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true })));
  assert.equal(document.querySelector('[role="listbox"]'), null);
  assert.equal(closed, 0);
  await escape(trigger);
  assert.equal(closed, 1);
});

test("ordinary modal dismissal remains available when the new lock is not enabled", async () => {
  let closed = 0;
  await render(Modal, { isOpen: true, title: "Existing modal", onClose: () => { closed += 1; } });
  await escape();
  await act(async () => dialog().parentElement.click());
  await act(async () => button("Close modal", dialog()).click());
  assert.equal(closed, 3);
});
