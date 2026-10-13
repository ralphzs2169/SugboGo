import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "vite";

let server;
let apiClient;
let service;
let originalGet;

before(async () => {
  server = await createServer({
    appType: "custom",
    server: { middlewareMode: true },
  });
  ({ default: apiClient } = await server.ssrLoadModule(
    "/src/shared/api/apiClient.js",
  ));
  service = await server.ssrLoadModule(
    "/src/features/admin-panel/suspicious-reviews/services/suspiciousReviewService.js",
  );
  originalGet = apiClient.get;
});

after(async () => {
  if (apiClient) {
    apiClient.get = originalGet;
  }
  await server?.close();
});

test("queue forwards search, signal, sort, and pagination to the Admin API", async () => {
  const calls = [];
  const params = {
    search: "Cafe",
    signal: "duplicate_content",
    ordering: "oldest",
    page: 2,
    page_size: 10,
  };
  apiClient.get = async (...args) => {
    calls.push(args);
    return { data: { data: { items: [], pagination: { page: 2 } } } };
  };

  const result = await service.fetchSuspiciousReviews(params);

  assert.deepEqual(calls, [["/admin/suspicious-reviews/", { params }]]);
  assert.equal(result.pagination.page, 2);
});

test("detail uses the read-only Admin investigation endpoint", async () => {
  const calls = [];
  apiClient.get = async (...args) => {
    calls.push(args);
    return { data: { data: { id: 83 } } };
  };

  const result = await service.fetchSuspiciousReview(83);

  assert.deepEqual(calls, [["/admin/suspicious-reviews/83/"]]);
  assert.equal(result.id, 83);
});
