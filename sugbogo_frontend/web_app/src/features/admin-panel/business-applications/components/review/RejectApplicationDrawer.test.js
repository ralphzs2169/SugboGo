import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";
let server, Drawer;
before(async () => {
  server = await createServer({
    appType: "custom",
    server: { middlewareMode: true, hmr: false },
    plugins: [
      {
        name: "drawer-server-render",
        enforce: "pre",
        transform(code, id) {
          if (
            !id.replaceAll("\\", "/").endsWith("/RejectApplicationDrawer.jsx")
          )
            return;
          return code
            .replace(
              'import { createPortal } from "react-dom";',
              "const createPortal = (children) => children;",
            )
            .replace("document.body,", "null,");
        },
      },
    ],
  });
  ({ default: Drawer } = await server.ssrLoadModule(
    "/src/features/admin-panel/business-applications/components/review/RejectApplicationDrawer.jsx",
  ));
});
after(async () => {
  await server?.close();
});
function render(candidates) {
  return renderToString(
    React.createElement(Drawer, {
      isOpen: true,
      applicationId: 1,
      expectedSubmissionId: 7,
      businessName: "Cafe",
      duplicateQuery: { data: { submission_id: 7, candidates }, refetch() {} },
      onClose() {},
    }),
  );
}
test("saved confirmation opens duplicate workflow directly without a rejection selector", () => {
  const html = render([
    {
      key: "business:1",
      fingerprint: "one",
      assessment: { decision: "confirmed_duplicate" },
      stale: false,
    },
  ]);
  assert.match(html, /Duplicate assessment saved/);
  assert.match(html, /Explanation shown to merchant/);
  assert.match(html, /Business already registered/);
  assert.match(html, /Also require section corrections/);
  assert.match(html, /Request corrections instead/);
  assert.doesNotMatch(html, /name="rejection-type"/);
});
test("unassessed, legitimate, ownership and stale candidates open ordinary corrections", () => {
  for (const candidates of [
    [],
    [{ assessment: null }],
    [{ assessment: { decision: "legitimate" } }],
    [{ assessment: { decision: "ownership_conflict" } }],
    [{ assessment: { decision: "confirmed_duplicate" }, stale: true }],
  ]) {
    const html = render(candidates);
    assert.match(html, /Corrections Required/);
    assert.match(html, /Business Identity/);
    assert.doesNotMatch(
      html,
      /merchant-duplicate-explanation|name="rejection-type"/,
    );
  }
});
