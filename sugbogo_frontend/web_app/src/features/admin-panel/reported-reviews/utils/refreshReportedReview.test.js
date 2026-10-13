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

function mockRefresh(items, pagination = { total_pages: items.length ? 1 : 0 }) {
  apiClient.get = async (url) => {
    assert.equal(url, "/admin/review-reports/reviews/");
    return { data: { data: { items, pagination } } };
  };
}

test("a completed review decision removes its detail and selects an adjacent group", async () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(["admin", "reported-reviews", "detail", 91], { id: 91 });
  mockRefresh([{ id: 92, pending_report_count: 1 }]);

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
  assert.equal(queryClient.getQueryData(["admin", "reported-reviews", "detail", 91]), undefined);
});

test("the final resolved review clears selection", async () => {
  const queryClient = new QueryClient();
  mockRefresh([]);

  const result = await refreshReportedReview({
    queryClient,
    listKey,
    params,
    previousItems: [{ id: 91 }],
    selectedId: 91,
    page: 1,
  });

  assert.equal(result.nextId, null);
  assert.equal(result.previousPage, false);
});

test("when a page becomes empty, navigation returns to the previous page", async () => {
  const queryClient = new QueryClient();
  mockRefresh([], { total_pages: 1 });

  const result = await refreshReportedReview({
    queryClient,
    listKey,
    params: { ...params, page: 2 },
    previousItems: [{ id: 91 }],
    selectedId: 91,
    page: 2,
  });

  assert.equal(result.nextId, null);
  assert.equal(result.previousPage, true);
});
