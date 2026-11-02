import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React, { act } from "react";
import toast from "react-hot-toast";
import { createServer } from "vite";

const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
let server;
let dom;
let root;
let hook;
const calls = [];
const dismissals = [];
const originalError = toast.error;
const originalDismiss = toast.dismiss;

before(async () => {
  dom = new JSDOM("<div id='root'></div>");
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client");
  root = createRoot(document.getElementById("root"));
  server = await createServer({ appType: "custom", optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false } });
  ({ default: hook } = await server.ssrLoadModule("/src/features/admin-panel/dashboard/hooks/useDashboardErrorNotification.js"));
  toast.error = (...args) => calls.push(args);
  toast.dismiss = (id) => dismissals.push(id);
});
after(async () => {
  await act(async () => root.unmount());
  await server.close();
  dom.window.close();
  toast.error = originalError;
  toast.dismiss = originalDismiss;
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});
function Harness({ sources }) {
  hook(sources);
  return null;
}
const render = async (sources) => act(async () => root.render(
  React.createElement(Harness, { sources }),
));
const failure = (message, status = 500) => ({ response: { status, data: { message } } });

test("Dashboard failures share one toast and recover without rerender storms", async () => {
  const error = failure("Summary unavailable");
  await render({ summary: { error } });
  assert.equal(calls.at(-1)[0], "Summary unavailable");
  const count = calls.length;
  await render({ summary: { error } });
  assert.equal(calls.length, count);
  await render({ summary: { error }, scores: { error: failure("Scores unavailable") } });
  assert.match(calls.at(-1)[0], /couldn't be loaded/);
  assert.doesNotMatch(calls.at(-1)[0], /Previously loaded/);
  assert.equal(new Set(calls.map(([, options]) => options.id)).size, 1);
  await render({ summary: {} });
  assert.equal(dismissals.at(-1), "admin-dashboard-load-error");
  await render({ summary: { error: failure("Retry failed") } });
  assert.equal(calls.at(-1)[0], "Retry failed");
});

test("cached refresh summary and mixed initial failures use accurate wording", async () => {
  await render({ summary: { error: {}, data: {} }, scores: { error: {}, data: {} } });
  assert.match(calls.at(-1)[0], /Previously loaded data is still available/);
  await render({ summary: { error: {}, data: {} }, scores: { error: {} } });
  assert.doesNotMatch(calls.at(-1)[0], /Previously loaded/);
});

for (const status of [401, 403]) {
  test(`authorization ${status} messages retain precedence`, async () => {
    await render({ summary: { error: failure("Generic") }, scores: { error: failure("Authorization message", status) } });
    assert.equal(calls.at(-1)[0], "Authorization message");
  });
}
