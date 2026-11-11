import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React, { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { createServer } from "vite";

const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
const categories = [
  ["business", "Businesses", "active", "/admin-panel/businesses/42"],
  ["user", "Users", "active", "/admin-panel/users/42"],
  ["application", "Merchant Applications", "submitted", "/admin-panel/business/application/42"],
  ["business_name_request", "Business Name Requests", "pending", "/admin-panel/businesses/update-requests/42"],
  ["classification_request", "Classification Requests", "approved", "/admin-panel/businesses/update-requests/classification/42"],
  ["location_request", "Location Requests", "rejected", "/admin-panel/businesses/update-requests/location/42"],
  ["review", "Reviews", "under_review", "/admin-panel/reviews?review_id=42"],
  ["review_dispute", "Review Disputes", "author_deleted", "/admin-panel/moderation-integrity?tab=disputes&dispute_id=42&status=all"],
];
let dom;
let server;
let Header;
let useUnsavedChangesGuard;
let EditorConfirmationModal;
let SidebarLink;
let auth;
let root;
let container;
let client;
let reads;
let transport;
let navigate;

function fixture(search) {
  return {
    search,
    groups: categories.map(([type, heading, status], index) => ({
      type,
      items: [{
        id: 42,
        title: `${search} ${heading}`,
        subtitle: index === 7 ? null : "Useful existing context",
        status,
      }],
      has_more: index === 0,
    })),
  };
}

before(async () => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost",
    pretendToBeVisual: true,
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  server = await createServer({
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false },
    plugins: [{
      name: "global-search-test-transport",
      enforce: "pre",
      load(id) {
        if (id.replaceAll("\\", "/").endsWith("/shared/api/apiClient.js")) {
          return "export default { get: (...args) => globalThis.__globalSearchGet(...args) };";
        }
      },
    }],
  });
  ({ default: Header } = await server.ssrLoadModule(
    "/src/features/admin-panel/components/NavigationHeader.jsx",
  ));
  ({ useAuthStore: auth } = await server.ssrLoadModule(
    "/src/features/auth/storage/auth.store.js",
  ));
  ({ default: useUnsavedChangesGuard } = await server.ssrLoadModule(
    "/src/features/admin-panel/transit-network/hooks/useUnsavedChangesGuard.js",
  ));
  ({ default: EditorConfirmationModal } = await server.ssrLoadModule(
    "/src/features/admin-panel/transit-network/components/route-variant-editor/EditorConfirmationModal.jsx",
  ));
  ({ default: SidebarLink } = await server.ssrLoadModule(
    "/src/features/admin-panel/components/sidebar/SidebarLink.jsx",
  ));
});

beforeEach(async () => {
  reads = [];
  transport = async (params) => fixture(params.search);
  globalThis.__globalSearchGet = async (url, options) => {
    if (url === "/notifications/unread-count/") {
      return { data: { data: { unread_count: 0 } } };
    }
    reads.push({ url, ...options });
    return { data: { data: await transport(options.params, options.signal) } };
  };
  auth.setState({
    user: { id: 7, role: "admin" },
    isAuthenticated: true,
    isLoading: false,
  });
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  container = document.createElement("div");
  document.body.append(container);
  const { createRoot } = await import("react-dom/client");
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
});

after(async () => {
  await server?.close();
  dom.window.close();
  for (const key of [
    "window", "document", "localStorage", "HTMLElement", "Element", "Node",
    "requestAnimationFrame", "cancelAnimationFrame", "IS_REACT_ACT_ENVIRONMENT",
    "__globalSearchGet",
  ]) {
    delete globalThis[key];
  }
});

function RouterProbe() {
  const location = useLocation();
  const go = useNavigate();
  React.useEffect(() => {
    navigate = go;
  }, [go]);
  return React.createElement("output", { "data-location": true }, location.pathname + location.search);
}

function TransitDraftWorkspace() {
  const [draft, setDraft] = React.useState("");
  const guard = useUnsavedChangesGuard(Boolean(draft));

  return React.createElement(React.Fragment, null,
    React.createElement("textarea", {
      "aria-label": "Transit draft",
      value: draft,
      onChange: (event) => setDraft(event.target.value),
    }),
    React.createElement(EditorConfirmationModal, {
      isOpen: guard.isLeaveConfirmationOpen,
      title: "Discard Unsaved Changes?",
      description: "Your current Transit Network edits have not been saved.",
      warning: "Discarded changes cannot be recovered after leaving this page.",
      confirmLabel: "Discard and Leave",
      onCancel: guard.stayOnPage,
      onConfirm: guard.discardAndLeave,
    }),
  );
}

function TransitNavigationFixture() {
  const current = useLocation();

  return React.createElement(React.Fragment, null,
    React.createElement(SidebarLink, {
      to: "/admin-panel/users/all",
      label: "All Users",
      Icon: () => null,
    }),
    current.pathname === "/admin-panel/transit-network"
      ? React.createElement(TransitDraftWorkspace)
      : null,
  );
}

async function render({ withTransitWorkspace = false } = {}) {
  await act(async () => root.render(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(
        MemoryRouter,
        {
          initialEntries: [withTransitWorkspace
            ? "/admin-panel/transit-network"
            : "/admin-panel/dashboard"],
        },
        React.createElement(React.Fragment, null,
          React.createElement(Header),
          React.createElement(RouterProbe),
          withTransitWorkspace ? React.createElement(TransitNavigationFixture) : null,
        ),
      ),
    ),
  ));
}

const input = () => container.querySelector('[role="combobox"]');
const options = () => [...container.querySelectorAll('[role="option"]')];
const location = () => container.querySelector("[data-location]").textContent;

async function pause(duration = 25) {
  await act(async () => new Promise((done) => setTimeout(done, duration)));
}

async function until(predicate) {
  for (let index = 0; index < 100; index += 1) {
    if (predicate()) return;
    await pause();
  }
  assert.fail("Global search did not reach the expected state");
}

async function type(value) {
  await act(async () => {
    input().focus();
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(input(), value);
    input().dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
}

async function press(key, target = input()) {
  const event = new dom.window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  await act(async () => target.dispatchEvent(event));
  return event;
}

async function editTransitDraft() {
  const textarea = container.querySelector('[aria-label="Transit draft"]');

  await act(async () => {
    Object.getOwnPropertyDescriptor(
      dom.window.HTMLTextAreaElement.prototype,
      "value",
    ).set.call(textarea, "Unsaved route geometry");
    textarea.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
}

async function clickButton(label) {
  const button = [...container.querySelectorAll("button")].find(
    (item) => item.textContent === label,
  );
  assert.ok(button, `Missing ${label} button`);
  await act(async () => button.click());
}

test("transit drafts survive canceled search navigation and confirmed searches keep the destination", async () => {
  await render({ withTransitWorkspace: true });
  await editTransitDraft();
  await type("cebu");
  await until(() => options().length === 8);
  await act(async () => options()[0].click());

  assert.equal(location(), "/admin-panel/transit-network");
  assert.equal(container.querySelectorAll('[role="dialog"]').length, 1);
  await clickButton("Keep Editing");
  assert.equal(location(), "/admin-panel/transit-network");
  assert.equal(container.querySelector('[role="dialog"]'), null);
  assert.equal(
    container.querySelector('[aria-label="Transit draft"]').value,
    "Unsaved route geometry",
  );

  await act(async () => input().focus());
  await until(() => options().length === 8);
  await press("ArrowUp");
  await press("Enter");
  assert.equal(location(), "/admin-panel/transit-network");
  assert.equal(container.querySelectorAll('[role="dialog"]').length, 1);
  await clickButton("Discard and Leave");
  assert.equal(location(), categories[7][3]);
  assert.equal(container.querySelector('[role="dialog"]'), null);
  assert.equal(container.querySelector('[aria-label="Transit draft"]'), null);

  // Leaving removes the guard, so subsequent search navigation stays normal.
  await type("cebu");
  await until(() => options().length === 8);
  await act(async () => options()[0].click());
  assert.equal(location(), categories[0][3]);
  assert.equal(container.querySelector('[role="dialog"]'), null);
});

test("sidebar links reuse the same transit confirmation and preserve canceled drafts", async () => {
  await render({ withTransitWorkspace: true });
  await editTransitDraft();
  const link = container.querySelector('a[href="/admin-panel/users/all"]');
  await act(async () => link.click());
  assert.equal(location(), "/admin-panel/transit-network");
  assert.equal(container.querySelectorAll('[role="dialog"]').length, 1);

  await clickButton("Keep Editing");
  assert.equal(
    container.querySelector('[aria-label="Transit draft"]').value,
    "Unsaved route geometry",
  );
  await act(async () => link.click());
  await clickButton("Discard and Leave");
  assert.equal(location(), "/admin-panel/users/all");
  assert.equal(container.querySelector('[role="dialog"]'), null);
});

test("clean transit workspaces navigate through search and sidebar without confirmation", async () => {
  await render({ withTransitWorkspace: true });
  await type("cebu");
  await until(() => options().length === 8);
  await press("ArrowDown");
  await press("Enter");
  assert.equal(location(), categories[0][3]);
  assert.equal(container.querySelector('[role="dialog"]'), null);

  await act(async () => navigate("/admin-panel/transit-network"));
  await act(async () => container.querySelector('a[href="/admin-panel/users/all"]').click());
  assert.equal(location(), "/admin-panel/users/all");
  assert.equal(container.querySelector('[role="dialog"]'), null);
});

test("transit refresh and history protection remain registered only while the draft is dirty", async () => {
  await render({ withTransitWorkspace: true });
  const cleanRefresh = new dom.window.Event("beforeunload", { cancelable: true });
  window.dispatchEvent(cleanRefresh);
  assert.equal(cleanRefresh.defaultPrevented, false);

  await editTransitDraft();
  const dirtyRefresh = new dom.window.Event("beforeunload", { cancelable: true });
  window.dispatchEvent(dirtyRefresh);
  assert.equal(dirtyRefresh.defaultPrevented, true);

  const originalConfirm = window.confirm;
  const originalForward = window.history.forward;
  let confirmations = 0;
  let reversals = 0;
  window.confirm = () => {
    confirmations += 1;
    return false;
  };
  window.history.forward = () => {
    reversals += 1;
  };

  try {
    await act(async () => window.dispatchEvent(new dom.window.PopStateEvent("popstate")));
    assert.equal(confirmations, 1);
    assert.equal(reversals, 1);
    assert.equal(container.querySelector('[role="dialog"]'), null);

    await act(async () => container.querySelector('a[href="/admin-panel/users/all"]').click());
    await clickButton("Discard and Leave");
    const departedRefresh = new dom.window.Event("beforeunload", { cancelable: true });
    window.dispatchEvent(departedRefresh);
    window.dispatchEvent(new dom.window.PopStateEvent("popstate"));
    assert.equal(departedRefresh.defaultPrevented, false);
    assert.equal(confirmations, 1);
  } finally {
    window.confirm = originalConfirm;
    window.history.forward = originalForward;
  }
});

test("debounces valid trimmed terms, avoids duplicates, and preserves the header shell", async () => {
  await render();
  assert.equal(container.querySelector('[role="listbox"]'), null);
  assert.equal(reads.length, 0);
  assert.ok(container.querySelector("header").classList.contains("h-16"));
  assert.ok(input().parentElement.classList.contains("md:block"));
  assert.ok(input().parentElement.classList.contains("hidden"));
  assert.ok(container.querySelector('[aria-label="Notifications"]'));
  assert.ok(container.querySelector('[aria-label="Toggle theme"]'));

  await type(" c ");
  await pause(430);
  assert.equal(reads.length, 0);
  assert.match(container.textContent, /Type at least 2 characters/);
  await type(" ce ");
  await pause(100);
  await type(" cebu ");
  await pause(100);
  assert.equal(reads.length, 0);
  await until(() => options().length === 8);
  assert.equal(reads.length, 1);
  assert.equal(reads[0].url, "/admin/search/");
  assert.deepEqual(reads[0].params, { search: "cebu", limit_per_type: 3 });
  assert.ok(reads[0].signal instanceof AbortSignal);

  await type("cebu  ");
  await pause(430);
  assert.equal(reads.length, 1);
  await type("x".repeat(201));
  await pause(430);
  assert.equal(reads.length, 1);
  assert.equal(options().length, 0);
  assert.match(container.textContent, /200 characters or fewer/);
});

test("renders ordered groups and supports arrow selection, Enter, and normal Tab exit", async () => {
  await render();
  await type("cebu");
  await until(() => options().length === 8);
  assert.deepEqual(
    [...container.querySelectorAll('[role="group"]')].map((group) =>
      document.getElementById(group.getAttribute("aria-labelledby")).textContent.trim(),
    ),
    categories.map((category) => category[1]),
  );
  assert.match(container.textContent, /More matches available/);
  assert.match(container.textContent, /Pending Review/);
  assert.match(container.textContent, /Under Review/);
  assert.match(container.textContent, /Author Deleted/);
  const list = document.getElementById(input().getAttribute("aria-controls"));
  assert.equal(list.getAttribute("role"), "listbox");
  assert.match(list.parentElement.className, /absolute.*top-full.*z-50.*overflow-y-auto/);

  await press("ArrowDown");
  assert.equal(input().getAttribute("aria-activedescendant"), options()[0].id);
  assert.equal(options()[0].getAttribute("aria-selected"), "true");
  await press("ArrowUp");
  assert.equal(input().getAttribute("aria-activedescendant"), options()[7].id);
  assert.equal(document.activeElement, input());
  const tab = await press("Tab");
  assert.equal(tab.defaultPrevented, false);
  await act(async () => container.querySelector('[aria-label="Toggle theme"]').focus());
  assert.equal(input().getAttribute("aria-expanded"), "false");

  await act(async () => input().focus());
  await until(() => options().length === 8);
  await press("ArrowDown");
  await press("Enter");
  assert.equal(location(), categories[0][3]);
  assert.equal(input().value, "");
  assert.equal(input().getAttribute("aria-expanded"), "false");
});

test("mouse selection navigates all eight types including review and dispute URL state", async () => {
  await render();
  for (const [recordType, , , destination] of categories) {
    await type("cebu");
    await until(() => options().length === 8);
    const option = options().find((item) => item.id.endsWith(`${recordType}:42`));
    assert.ok(option);
    await act(async () => {
      option.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      option.click();
    });
    assert.equal(location(), destination);
    assert.equal(input().getAttribute("aria-expanded"), "false");
  }
});

test("compact rows retain type icons, bounded text, secondary IDs, and aligned navigation", async () => {
  const longTitle = "A long business or record title ".repeat(12);
  const longSubtitle = "long-context@example.com".repeat(15);
  transport = async (params) => {
    const data = fixture(params.search);
    for (const group of data.groups) {
      group.items[0].title = longTitle;
      group.items[0].subtitle = longSubtitle;
    }
    return data;
  };
  await render();
  await type("cebu");
  await until(() => options().length === 8);
  const icons = ["store", "user", "clipboard", "file-pen", "tags", "map-pin", "message-square", "shield-alert"];
  for (const [index, option] of options().entries()) {
    assert.ok(option.querySelector(`.lucide-${icons[index]}`));
    assert.ok(option.querySelector(".lucide-chevron-right.shrink-0"));
    assert.equal(option.querySelector("img"), null);
    assert.equal(option.querySelector(".line-clamp-2").textContent, longTitle);
    assert.equal(option.querySelector(".line-clamp-1").textContent, longSubtitle);
    assert.match(option.textContent, /\w+ #42/);
    assert.ok(option.classList.contains("items-center"));
    assert.ok(option.classList.contains("hover:bg-interaction-hover"));
    assert.ok(option.querySelector(".rounded-full.shrink-0"));
  }
  for (const group of container.querySelectorAll('[role="group"]')) {
    assert.ok(group.querySelector(".uppercase.tracking-wide"));
    assert.ok(group.querySelector(".border-b.border-stroke"));
    assert.match(group.textContent, /1 shown/);
  }
  await press("ArrowDown");
  assert.ok(options()[0].classList.contains("bg-interaction-hover"));
});

test("shows empty and persistent inline error states, retries, and dismisses from Retry", async () => {
  transport = async (params) => ({
    search: params.search,
    groups: fixture(params.search).groups.map((group) => ({ ...group, items: [], has_more: false })),
  });
  await render();
  await type("empty");
  await until(() => container.textContent.includes("No results found"));
  assert.equal(options().length, 0);
  assert.equal(container.querySelector('[role="group"]'), null);

  transport = async () => {
    throw Object.assign(new Error("Unavailable"), { response: { data: { message: "Try again shortly." } } });
  };
  await type("failure");
  await until(() => container.textContent.includes("Try again shortly."));
  const retry = () => [...container.querySelectorAll("button")].find((button) => button.textContent === "Retry");
  await pause(50);
  assert.ok(retry());
  assert.ok(container.querySelector('[role="alert"]'));
  assert.equal(options().length, 0);
  await act(async () => retry().focus());
  await press("Escape", retry());
  assert.equal(document.activeElement, input());
  assert.equal(input().getAttribute("aria-expanded"), "false");

  await act(async () => input().click());
  await until(() => retry());
  transport = async (params) => fixture(params.search);
  const count = reads.length;
  await act(async () => retry().click());
  await until(() => options().length === 8);
  assert.equal(reads.length, count + 1);
  assert.equal(document.activeElement, input());
});

test("aborts superseded or dismissed reads and ignores late responses and route changes", async () => {
  const pending = new Map();
  transport = (params) => new Promise((done) => pending.set(params.search, done));
  await render();
  await type("first");
  await until(() => reads.length === 1);
  assert.match(container.textContent, /Searching administration/);
  assert.equal(container.querySelector('[role="listbox"]').getAttribute("aria-busy"), "true");
  await type("second");
  assert.equal(reads[0].signal.aborted, true);
  assert.equal(options().length, 0);
  await until(() => reads.length === 2);
  await act(async () => pending.get("second")(fixture("second")));
  await until(() => options().length === 8);
  await act(async () => pending.get("first")(fixture("first")));
  assert.ok(options().every((option) => option.textContent.includes("second")));

  await type("third");
  assert.equal(options().length, 0);
  await until(() => reads.length === 3);
  await act(async () => document.body.dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles: true })));
  assert.equal(reads[2].signal.aborted, true);
  await act(async () => pending.get("third")(fixture("third")));
  assert.equal(container.querySelector('[role="listbox"]'), null);

  await type("fourth");
  await until(() => reads.length === 4);
  await act(async () => navigate("/admin-panel/users/all"));
  assert.equal(reads[3].signal.aborted, true);
  await act(async () => pending.get("fourth")(fixture("fourth")));
  assert.equal(input().value, "");
  assert.equal(container.querySelector('[role="listbox"]'), null);
});

test("only restored Admin sessions can search and session loss removes pending results", async () => {
  auth.setState({ user: { id: 7, role: "explorer" } });
  await render();
  assert.equal(input(), null);
  assert.equal(reads.length, 0);

  await act(async () => auth.setState({ user: { id: 7, role: "super_admin" }, isLoading: true }));
  assert.equal(input(), null);
  await act(async () => auth.setState({ isLoading: false }));
  let finish;
  transport = () => new Promise((done) => { finish = done; });
  await type("cebu");
  await until(() => reads.length === 1);
  await act(async () => auth.getState().clearUser());
  assert.equal(input(), null);
  assert.equal(reads[0].signal.aborted, true);
  await act(async () => finish(fixture("cebu")));
  assert.equal(container.querySelector('[role="listbox"]'), null);
});
