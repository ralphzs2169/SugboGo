import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React, { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

// Reuse the monorepo's installed test DOM without adding a dependency.
const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
const detailKey = ["admin", "review-dispute", "16"];
const fingerprint = "a".repeat(64);
const latestFingerprint = "b".repeat(64);
const notes = "The current review was inspected and the evidence supports this decision.";
let server;
let Workspace;
let createRoot;
let root;
let container;
let dom;
let queryClient;
let detail;
let posts;
let detailReads;
let conflict;
let failRefresh;
let rejectSubmission;

function fixture() {
  const review = {
    id: 72,
    exists: true,
    text: "Filing-time review content.",
    status: "published",
    created_at: "2026-10-11T02:00:00Z",
    edited_at: null,
    photos: [],
    author: { id: 42, first_name: "Ana", last_name: "Reyes" },
    report_count: 0,
  };
  return {
    id: 16,
    status: "pending",
    reason: "fake_review",
    description: "The merchant disputes this review.",
    attempt_number: 2,
    original_review_id: 72,
    merchant_id: 9,
    merchant: { name: "Maria Santos" },
    business: { id: 17, name: "Savor Kitchen", specialty_tags: [] },
    review,
    current_review: review,
    current_content_fingerprint: fingerprint,
    material_content_changed: false,
    filing_snapshot_unavailable: false,
    decision_eligible: true,
    review_at_filing: {
      available: true,
      review_id: 72,
      author_id: 42,
      text: review.text,
      status: review.status,
      submitted_at: review.created_at,
      edited_at: null,
      photos: [],
    },
    evidence: [],
    previous_disputes: [{
      id: 8,
      reason: "fake_review",
      status: "dismissed",
      review_at_filing: { available: false },
    }],
  };
}

function listData() {
  const items = detail.status === "pending" ? [{
    id: 16,
    status: detail.status,
    reason: detail.reason,
    merchant: detail.merchant,
    business_name: "Savor Kitchen",
    review_id: 72,
    review_text_preview: "Filing-time review content.",
    attempt_number: 2,
  }] : [];
  return { items, pagination: { total_items: items.length, total_pages: 1 } };
}

before(async () => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost",
    pretendToBeVisual: true,
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = clearTimeout;
  globalThis.IntersectionObserver = class {
    observe() {}
    disconnect() {}
  };
  ({ createRoot } = await import("react-dom/client"));
  server = await createServer({
    appType: "custom",
    server: { middlewareMode: true, hmr: false },
    plugins: [{
      name: "dispute-api-fixture",
      enforce: "pre",
      load(id) {
        if (id.replaceAll("\\", "/").endsWith("/shared/api/apiClient.js")) {
          return `export default {
            get: (...args) => globalThis.__disputeTransport.get(...args),
            post: (...args) => globalThis.__disputeTransport.post(...args),
          };`;
        }
      },
    }],
  });
  ({ default: Workspace } = await server.ssrLoadModule(
    "/src/features/admin-panel/review-disputes/components/ReviewDisputeWorkspace.jsx",
  ));
});

beforeEach(() => {
  detail = fixture();
  posts = [];
  detailReads = [];
  conflict = false;
  failRefresh = false;
  rejectSubmission = null;
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: Infinity, gcTime: Infinity, retry: false },
      mutations: { retry: 1, retryDelay: 0 },
    },
  });
  globalThis.__disputeTransport = {
    async get(url) {
      if (url === "/admin/review-disputes/") {
        return { data: { data: listData() } };
      }
      detailReads.push(url);
      if (failRefresh) {
        throw new Error("Investigation unavailable");
      }
      if (url.endsWith("/8/")) {
        return { data: { data: {
          ...detail,
          id: 8,
          status: "dismissed",
          decision_eligible: false,
          attempt_number: 1,
          review_at_filing: { available: false },
          filing_snapshot_unavailable: true,
          material_content_changed: null,
          previous_disputes: [],
        } } };
      }
      return { data: { data: detail } };
    },
    async post(url, payload) {
      posts.push({ url, payload });
      if (conflict) {
        detail = {
          ...detail,
          current_review: { ...detail.current_review, text: "Latest revised review content." },
          current_content_fingerprint: latestFingerprint,
          material_content_changed: true,
        };
        const error = new Error("Review changed");
        error.response = {
          status: 409,
          data: { code: "REVIEW_CONTENT_CHANGED", message: "Refresh the investigation." },
        };
        throw error;
      }
      if (rejectSubmission) {
        throw rejectSubmission;
      }
      detail = {
        ...detail,
        status: url.endsWith("/uphold/") ? "upheld" : "dismissed",
        decision_eligible: false,
      };
      return { data: { success: true, data: detail } };
    },
  };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  queryClient.clear();
  container.remove();
});

after(async () => {
  await server?.close();
  dom?.window.close();
  delete globalThis.__disputeTransport;
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

async function renderWorkspace() {
  queryClient.setQueryData(detailKey, detail);
  queryClient.setQueryData(["admin", "review-disputes", {
    page: 1,
    page_size: 10,
    search: undefined,
    status: "pending",
    reason: undefined,
    ordering: "-created_at",
  }], listData());
  await act(async () => root.render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ["/admin-panel/moderation-integrity?tab=disputes&dispute_id=16"] },
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(Workspace),
      ),
    ),
  ));
}

function button(label, scope = container) {
  const result = [...scope.querySelectorAll("button")].find(
    (element) => element.textContent.trim() === label,
  );
  assert.ok(result, `Expected a button labeled ${label}`);
  return result;
}

function dialog() {
  return container.querySelector('[role="dialog"]');
}

async function click(element) {
  await act(async () => element.click());
}

async function enterNotes(value = notes) {
  const textarea = dialog().querySelector("textarea");
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")
      .set.call(textarea, value);
    textarea.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
}

async function waitFor(condition) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (condition()) {
      return;
    }
    await act(async () => new Promise((resolveDelay) => setTimeout(resolveDelay, 5)));
  }
  assert.ok(condition(), "Expected the dispute UI to finish updating");
}

test("unchanged Uphold submits the displayed fingerprint and trimmed notes without acknowledgement", async () => {
  await renderWorkspace();
  await click(button("Uphold Dispute"));
  assert.equal(dialog().querySelector('input[type="checkbox"]'), null);
  await enterNotes(`  ${notes}  `);
  await click(button("Uphold Dispute", dialog()));
  await waitFor(() => dialog() === null);

  assert.deepEqual(posts, [{
    url: "/admin/review-disputes/16/uphold/",
    payload: { expected_fingerprint: fingerprint, admin_notes: notes },
  }]);
});

test("Dismiss submits the loaded fingerprint even for changed content and needs no acknowledgement", async () => {
  detail.material_content_changed = true;
  await renderWorkspace();
  await click(button("Dismiss"));
  assert.equal(dialog().querySelector('input[type="checkbox"]'), null);
  await enterNotes();
  await click(button("Dismiss Dispute", dialog()));
  await waitFor(() => dialog() === null);

  assert.deepEqual(posts[0], {
    url: "/admin/review-disputes/16/dismiss/",
    payload: { expected_fingerprint: fingerprint, admin_notes: notes },
  });
});

for (const state of ["changed", "legacy"]) {
  test(`${state} Uphold requires acknowledgement and a meaningful explanation`, async () => {
    if (state === "legacy") {
      detail.review_at_filing = { available: false };
      detail.filing_snapshot_unavailable = true;
      detail.material_content_changed = null;
    } else {
      detail.material_content_changed = true;
    }
    await renderWorkspace();
    await click(button("Uphold Dispute"));
    assert.match(dialog().textContent, /Uphold rejects the current review/);
    const checkbox = dialog().querySelector('input[type="checkbox"]');
    await enterNotes("Too short");
    await click(checkbox);
    assert.equal(button("Uphold Dispute", dialog()).disabled, true);
    await click(checkbox);
    await enterNotes();
    assert.equal(button("Uphold Dispute", dialog()).disabled, true);
    await act(async () => dialog().querySelector("form").dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    ));
    assert.equal(posts.length, 0);
    await click(checkbox);
    await click(button("Uphold Dispute", dialog()));
    await waitFor(() => dialog() === null);
    assert.equal(posts[0].payload.acknowledge_review_changes, true);
    assert.equal(posts[0].payload.expected_fingerprint, fingerprint);
  });
}

test("HTTP 409 keeps the modal open, refreshes evidence and requires a new inspection and confirmation", async () => {
  conflict = true;
  await renderWorkspace();
  await click(button("Uphold Dispute"));
  await enterNotes();
  await click(button("Uphold Dispute", dialog()));
  await waitFor(() => dialog()?.textContent.includes("has been refreshed"));

  assert.equal(posts.length, 1);
  assert.deepEqual(detailReads, ["/admin/review-disputes/16/"]);
  assert.match(dialog().querySelector('[role="alert"]').textContent, /review changed/i);
  assert.match(container.textContent, /Latest revised review content/);
  assert.equal(button("Uphold Dispute", dialog()).disabled, true);
  assert.equal(dialog().querySelector("textarea").value, "");
  await act(async () => dialog().querySelector("form").dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  ));
  assert.equal(posts.length, 1);

  await click(button("Review latest content", dialog()));
  assert.equal(dialog(), null);
  await click(button("Uphold Dispute"));
  assert.equal(dialog().querySelector('input[type="checkbox"]').checked, false);
  assert.equal(button("Uphold Dispute", dialog()).disabled, true);
  await enterNotes();
  await click(dialog().querySelector('input[type="checkbox"]'));
  conflict = false;
  await click(button("Uphold Dispute", dialog()));
  await waitFor(() => dialog() === null);
  assert.equal(posts.length, 2);
  assert.equal(posts[1].payload.expected_fingerprint, latestFingerprint);
  assert.equal(posts[1].payload.acknowledge_review_changes, true);
});

test("a failed conflict refresh keeps decisions blocked until investigation recovery", async () => {
  conflict = true;
  failRefresh = true;
  await renderWorkspace();
  await click(button("Dismiss"));
  await enterNotes();
  await click(button("Dismiss Dispute", dialog()));
  await waitFor(() => dialog()?.textContent.includes("could not be refreshed"));

  assert.equal(posts.length, 1);
  assert.equal(button("Dismiss Dispute", dialog()).disabled, true);
  await click(button("Review latest content", dialog()));
  assert.match(container.textContent, /Unable to load this dispute/);
  assert.equal(container.querySelector('[aria-label="Review decision"]'), null);
});

test("an investigation updated while its modal is open cannot silently substitute a fingerprint", async () => {
  await renderWorkspace();
  await click(button("Dismiss"));
  await enterNotes();
  await act(async () => queryClient.setQueryData(detailKey, {
    ...detail,
    current_content_fingerprint: latestFingerprint,
    material_content_changed: true,
  }));
  await click(button("Dismiss Dispute", dialog()));

  assert.equal(posts.length, 0);
  assert.match(dialog().textContent, /investigation changed/);
  assert.equal(button("Dismiss Dispute", dialog()).disabled, true);
});

test("ineligible and deleted reviews cannot open decision dialogs", async () => {
  detail.decision_eligible = false;
  await renderWorkspace();
  assert.equal(button("Dismiss").disabled, true);
  assert.equal(button("Uphold Dispute").disabled, true);
  await click(button("Uphold Dispute"));
  assert.equal(dialog(), null);

  await act(async () => queryClient.setQueryData(detailKey, {
    ...detail,
    current_review: { exists: false },
    current_content_fingerprint: null,
    decision_eligible: true,
  }));
  await waitFor(() => container.textContent.includes("original review has been deleted"));
  assert.equal(button("Dismiss").disabled, true);
  assert.equal(button("Uphold Dispute").disabled, true);
  assert.equal(posts.length, 0);
});

test("ordinary decision errors preserve editable notes and do not refresh or close the modal", async () => {
  rejectSubmission = new Error("Validation failed");
  rejectSubmission.response = {
    status: 400,
    data: { errors: { admin_notes: ["Please clarify the current review violation."] } },
  };
  await renderWorkspace();
  await click(button("Dismiss"));
  await enterNotes();
  await click(button("Dismiss Dispute", dialog()));
  await waitFor(() => dialog()?.textContent.includes("Please clarify"));

  assert.equal(dialog().querySelector("textarea").value, notes);
  assert.equal(dialog().querySelector("textarea").disabled, false);
  assert.equal(detailReads.length, 0);
  assert.equal(posts.length, 1);
});

test("previous-attempt navigation loads that attempt's own snapshot availability", async () => {
  await renderWorkspace();
  await click(container.querySelector('[aria-label="View dispute attempt 1"]'));
  await waitFor(() => container.textContent.includes("Dispute #8"));

  assert.match(container.textContent, /Filing-time snapshot unavailable/);
  assert.match(container.textContent, /Current Review/);
  assert.equal(container.querySelector('[aria-label="Review decision"]'), null);
  assert.ok(detailReads.includes("/admin/review-disputes/8/"));
});
