import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";
let server, Approval, Rejection;
before(async () => {
  server = await createServer({
    appType: "custom",
    server: { middlewareMode: true, hmr: false },
  });
  ({ default: Approval } = await server.ssrLoadModule(
    "/src/features/admin-panel/business-applications/components/review/ApproveApplicationConfirmationModal.jsx",
  ));
  ({ default: Rejection } = await server.ssrLoadModule(
    "/src/features/admin-panel/business-applications/components/review/RejectApplicationConfirmationModal.jsx",
  ));
});
after(async () => {
  await server?.close();
});
test("existing approval modal disables final approval and explains uncertainty", () => {
  const html = renderToString(
    React.createElement(Approval, {
      isOpen: true,
      identity: { business_name: "Cafe" },
      blockedReason: "Duplicate check unavailable",
      onClose() {},
      onConfirm() {},
    }),
  );
  assert.match(html, /Duplicate check unavailable/);
  assert.match(html, /disabled/);
  assert.match(html, /Approve Application/);
});
test("one rejection confirmation displays duplicate explanation and ordinary feedback", () => {
  const html = renderToString(
    React.createElement(Rejection, {
      isOpen: true,
      businessName: "Cafe",
      duplicateExplanation: "Same establishment",
      selectedSections: ["identity"],
      feedback: { identity: "Correct phone" },
      sections: [{ value: "identity", label: "Identity" }],
      onClose() {},
      onConfirm() {},
    }),
  );
  assert.match(html, /Same establishment/);
  assert.match(html, /Correct phone/);
  assert.match(html, /Reject Application/);
});

test("duplicate rejection confirmation blocks a decision whose assessment became unavailable", () => {
  const html = renderToString(
    React.createElement(Rejection, {
      isOpen: true,
      businessName: "Cafe",
      duplicateExplanation: "Same establishment",
      selectedSections: [],
      feedback: {},
      sections: [],
      blockedReason: "Confirmed Duplicate is no longer available",
      onClose() {},
      onConfirm() {},
    }),
  );
  assert.match(html, /Confirmed Duplicate is no longer available/);
  assert.match(html, /disabled/);
});
