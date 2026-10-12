import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { createServer } from "vite";

let server;
let apiClient;
let refreshReportedReview;
let originalGet;

const params = {
  page: 1,
  page_size: 10,
  search: "",
  reason: undefined,
  ordering: "most_reported",
};
const listKey = ["admin", "reported-reviews", "list", params];

before(async () => {
  server = await createServer({
    appType: "custom",
    server: { middlewareMode: true },
  });
  ({ default: apiClient } = await server.ssrLoadModule(
    "/src/shared/api/apiClient.js",
  ));
  ({ refreshReportedReview } = await server.ssrLoadModule(
    "/src/features/admin-panel/reported-reviews/utils/refreshReportedReview.js",
  ));
  originalGet = apiClient.get;
});

after(async () => {
  if (apiClient) {
    apiClient.get = originalGet;
  }
  await server?.close();
});

function mockRefresh(items, detail) {
  apiClient.get = async (url) => {
    if (url === "/admin/review-reports/reviews/") {
      return {
        data: {
          data: {
            items,
            pagination: { total_pages: items.length ? 1 : 0 },
          },
        },
      };
    }
    if (detail) {
      return { data: { data: detail } };
    }
    throw { response: { status: 404 } };
  };
}

test("after dismissing one report, refreshed counts and selected detail replace cached data", async () => {
  const queryClient = new QueryClient();
  mockRefresh(
    [{ id: 91, pending_report_count: 2, needs_attention: false }],
    { id: 91, pending_report_count: 2, needs_attention: false },
  );

  const result = await refreshReportedReview({
    queryClient,
    listKey,
    params,
    previousItems: [{ id: 91, pending_report_count: 3, needs_attention: true }],
    selectedId: 91,
    page: 1,
  });

  assert.equal(result.nextId, 91);
  assert.equal(queryClient.getQueryData(listKey).items[0].pending_report_count, 2);
  assert.equal(queryClient.getQueryData(listKey).items[0].needs_attention, false);
  assert.equal(queryClient.getQueryData(["admin", "reported-reviews", "detail", 91]).pending_report_count, 2);
});

test("after the last pending report, the group disappears and an adjacent review is selected", async () => {
  const queryClient = new QueryClient();
  mockRefresh([{ id: 92, pending_report_count: 1 }], null);

  const result = await refreshReportedReview({
    queryClient,
    listKey,
    params,
    previousItems: [{ id: 91 }, { id: 92 }],
    selectedId: 91,
    page: 1,
  });

  assert.equal(result.nextId, 92);
  assert.deepEqual(queryClient.getQueryData(listKey).items.map((item) => item.id), [92]);
});

test("rejected reviews with pending siblings remain selected after confirmation", async () => {
  const queryClient = new QueryClient();
  mockRefresh(
    [{ id: 91, status: "rejected", pending_report_count: 1 }],
    { id: 91, status: "rejected", pending_report_count: 1 },
  );

  const result = await refreshReportedReview({
    queryClient,
    listKey,
    params,
    previousItems: [{ id: 91, status: "published", pending_report_count: 2 }],
    selectedId: 91,
    page: 1,
  });

  assert.equal(result.nextId, 91);
  assert.equal(queryClient.getQueryData(["admin", "reported-reviews", "detail", 91]).status, "rejected");
});

test("selection stays open while siblings remain even when a reason filter excludes it", async () => {
  const queryClient = new QueryClient();
  mockRefresh([{ id: 92, pending_report_count: 1 }], { id: 91, pending_report_count: 1 });

  const result = await refreshReportedReview({
    queryClient,
    listKey,
    params,
    previousItems: [{ id: 91 }, { id: 92 }],
    selectedId: 91,
    page: 1,
  });

  assert.equal(result.nextId, 91);
});
