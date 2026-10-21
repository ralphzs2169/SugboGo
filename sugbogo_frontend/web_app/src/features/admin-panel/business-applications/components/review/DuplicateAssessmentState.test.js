import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import React, { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";

// Reuse the monorepo's installed mobile test DOM; no production dependency.
const { JSDOM } = createRequire(resolve("../mobile/package.json"))("jsdom");
let server, Page, createRoot, root, container, dom, application;
let saves, approvals, rejections;
const baseAssessment = {
  decision: "legitimate",
  explanation: "Separate established branch.",
  reviewed_at: "2026-10-21T01:00:00Z",
};

before(async () => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost",
    pretendToBeVisual: true,
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.CustomEvent = dom.window.CustomEvent;
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
    plugins: [
      {
        name: "duplicate-assessment-state-fixtures",
        enforce: "pre",
        load(id) {
          const file = id.replaceAll("\\", "/").split("/").at(-1);
          if (file === "Tooltip.jsx") {
            return "export default ({children}) => children";
          }
          if (file === "useApplicationDuplicates.js") {
            return "export default () => globalThis.__assessmentTestDuplicates";
          }
          if (file === "useApproveBusinessApplication.js") {
            return "export default () => ({approveApplication: globalThis.__assessmentTestApprove, isSubmitting: false})";
          }
          if (file === "useRejectBusinessApplication.js") {
            return "export default () => ({rejectApplication: globalThis.__assessmentTestReject, isSubmitting: false})";
          }
          if (
            [
              "ApplicationReviewHeader.jsx",
              "ReviewContextBar.jsx",
              "BusinessDocumentsReview.jsx",
              "BusinessHoursReview.jsx",
              "BusinessIdentityReview.jsx",
              "BusinessLocationReview.jsx",
              "BusinessPhotosReview.jsx",
            ].includes(file)
          ) {
            return "export default () => null";
          }
        },
      },
    ],
  });
  ({ default: Page } = await server.ssrLoadModule(
    "/src/features/admin-panel/business-applications/components/review/BusinessApplicationReview.jsx",
  ));
});

beforeEach(() => {
  saves = [];
  approvals = [];
  rejections = [];
  globalThis.__assessmentTestApprove = async (...args) => approvals.push(args);
  globalThis.__assessmentTestReject = async (...args) => rejections.push(args);
  application = {
    id: 1,
    latest_submission_id: 7,
    status: "submitted",
    identity: { business_name: "Cafe" },
    photos: [],
    documents: [],
  };
  globalThis.__assessmentTestDuplicates = {
    query: {
      data: {
        submission_id: 7,
        approval_blocked: false,
        candidates: [
          {
            key: "business:2",
            record_id: 2,
            record_type: "business",
            business_name: "Nearby Cafe",
            address: "Cebu City",
            status: "active",
            reasons: ["exact_name_and_address"],
            fingerprint: "one",
            stale: false,
            resolved: true,
            assessment: { ...baseAssessment },
          },
        ],
      },
      refetch() {},
    },
    mutation: {
      isPending: false,
      mutate(payload, options) {
        saves.push(payload);
        const state = globalThis.__assessmentTestDuplicates.query.data;
        const candidate = state.candidates[0];
        candidate.assessment = {
          decision: payload.decision,
          explanation: payload.explanation,
          reviewed_at: "2026-10-21T03:00:00Z",
        };
        candidate.resolved = payload.decision === "legitimate";
        state.approval_blocked = !candidate.resolved;
        options.onSuccess(state);
      },
    },
  };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
after(async () => {
  await server?.close();
  dom.window.close();
  delete globalThis.__assessmentTestDuplicates;
  delete globalThis.__assessmentTestApprove;
  delete globalThis.__assessmentTestReject;
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

async function renderPage() {
  await act(async () =>
    root.render(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(Page, { application }),
      ),
    ),
  );
}
function button(label) {
  return [...document.querySelectorAll("button")].find(
    (element) => element.textContent.trim() === label,
  );
}
async function click(element) {
  await act(async () => element.click());
}
async function editExplanation(text) {
  const input = container.querySelector("textarea");
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    ).set.call(input, text);
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
}
async function remoteUpdate() {
  const state = globalThis.__assessmentTestDuplicates.query.data;
  state.candidates[0] = {
    ...state.candidates[0],
    assessment: {
      decision: "ownership_conflict",
      explanation: "Ownership evidence requires investigation.",
      reviewed_at: "2026-10-21T02:00:00Z",
    },
    resolved: false,
  };
  state.approval_blocked = true;
  await renderPage();
}

test("pristine controls synchronize a remote saved assessment without remounting", async () => {
  await renderPage();
  const originalInput = container.querySelector("textarea");
  await remoteUpdate();
  assert.equal(container.querySelector("textarea"), originalInput);
  assert.equal(
    originalInput.value,
    "Ownership evidence requires investigation.",
  );
  assert.equal(
    container.querySelector('input[value="ownership_conflict"]').checked,
    true,
  );
  assert.doesNotMatch(
    container.textContent,
    /Unsaved changes|saved assessment changed/,
  );
  assert.equal(button("Reject Application").disabled, false);
});

test("dirty controls retain edits on remote refresh and discard loads the latest saved state", async () => {
  await renderPage();
  await editExplanation("My locally investigated separate branch.");
  await remoteUpdate();
  assert.equal(
    container.querySelector("textarea").value,
    "My locally investigated separate branch.",
  );
  assert.match(
    container.textContent,
    /saved assessment changed while you were editing/,
  );
  assert.ok(button("Save over latest assessment"));
  assert.equal(button("Approve Application").disabled, true);
  assert.equal(button("Reject Application").disabled, true);
  await click(button("Discard assessment changes"));
  assert.equal(
    container.querySelector("textarea").value,
    "Ownership evidence requires investigation.",
  );
  assert.doesNotMatch(
    container.textContent,
    /Save or discard assessment changes first/,
  );
  assert.equal(button("Reject Application").disabled, false);
  assert.equal(button("Approve Application").disabled, true); // Saved ownership conflict still blocks approval.
});

test("Approve and Reject remain blocked until local changes are saved", async () => {
  await renderPage();
  assert.equal(button("Approve Application").disabled, false);
  await editExplanation("Verified additional separate branch details.");
  assert.match(
    container.textContent,
    /Save or discard assessment changes first/,
  );
  await click(button("Approve Application"));
  await click(button("Reject Application"));
  assert.equal(approvals.length, 0);
  assert.equal(rejections.length, 0);
  assert.equal(document.querySelector('[role="dialog"]'), null);
  await click(button("Save Assessment"));
  assert.equal(saves.length, 1);
  assert.equal(button("Approve Application").disabled, false);
  assert.equal(button("Reject Application").disabled, false);
  assert.doesNotMatch(
    container.textContent,
    /Save or discard assessment changes first/,
  );
});

test("discarding local changes restores available final decisions", async () => {
  await renderPage();
  await editExplanation("Unsaved review note.");
  await click(button("Discard assessment changes"));
  assert.equal(
    container.querySelector("textarea").value,
    baseAssessment.explanation,
  );
  assert.equal(button("Approve Application").disabled, false);
  assert.equal(button("Reject Application").disabled, false);
});

test("dirty remote conflict requires an explicit save over the latest assessment", async () => {
  await renderPage();
  await editExplanation("I verified this is a separate legitimate branch.");
  await remoteUpdate();
  assert.equal(saves.length, 0);
  await click(button("Save over latest assessment"));
  assert.equal(saves[0].decision, "legitimate");
  assert.equal(
    saves[0].explanation,
    "I verified this is a separate legitimate branch.",
  );
  assert.equal(saves[0].fingerprint, "one");
  assert.equal(saves[0].submission_id, 7);
  assert.doesNotMatch(
    container.textContent,
    /saved assessment changed|Unsaved changes/,
  );
  assert.equal(button("Approve Application").disabled, false);
  assert.equal(button("Reject Application").disabled, false);
});

test("an already open approval confirmation is blocked by new assessment edits", async () => {
  await renderPage();
  await click(button("Approve Application"));
  assert.ok(document.querySelector('[role="dialog"]'));
  await editExplanation("Additional unsaved local review evidence.");
  const confirm = [
    ...document.querySelector('[role="dialog"]').querySelectorAll("button"),
  ].find((element) => element.textContent.trim() === "Approve Application");
  assert.equal(confirm.disabled, true);
  await click(confirm);
  assert.equal(approvals.length, 0);
});

test("an already open rejection drawer is blocked by new assessment edits", async () => {
  await renderPage();
  await click(button("Reject Application"));
  await editExplanation("Additional unsaved local review evidence.");
  assert.equal(button("Review & Reject").disabled, true);
  assert.match(
    document.querySelector('[role="dialog"]').textContent,
    /Save or discard assessment changes first/,
  );
  await click(button("Review & Reject"));
  assert.equal(rejections.length, 0);
});

test("discarding one candidate does not clear another candidate's unsaved edits", async () => {
  const state = globalThis.__assessmentTestDuplicates.query.data;
  state.candidates.push({
    ...state.candidates[0],
    key: "business:3",
    record_id: 3,
    business_name: "Another Cafe",
  });
  await renderPage();
  await editExplanation("First candidate unsaved note.");
  const second = container.querySelectorAll("textarea")[1];
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    ).set.call(second, "Second candidate unsaved note.");
    second.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  await click(button("Discard assessment changes"));
  assert.equal(button("Approve Application").disabled, true);
  assert.equal(button("Reject Application").disabled, true);
  await click(button("Discard assessment changes"));
  assert.equal(button("Approve Application").disabled, false);
  assert.equal(button("Reject Application").disabled, false);
});
