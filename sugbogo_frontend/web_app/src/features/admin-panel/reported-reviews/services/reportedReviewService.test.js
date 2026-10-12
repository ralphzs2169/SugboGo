import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "vite";

let server;
let apiClient;
let service;
let originalGet;
let originalPost;

before(async () => {
  server = await createServer({
    appType: "custom",
    server: { middlewareMode: true },
  });
  ({ default: apiClient } = await server.ssrLoadModule(
    "/src/shared/api/apiClient.js",
  ));
  service = await server.ssrLoadModule(
    "/src/features/admin-panel/reported-reviews/services/reportedReviewService.js",
  );
  originalGet = apiClient.get;
  originalPost = apiClient.post;
});

after(async () => {
  if (apiClient) {
    apiClient.get = originalGet;
    apiClient.post = originalPost;
  }
  await server?.close();
});

test("grouped queue forwards search, reason, sort, and pagination", async () => {
  const calls = [];
  const params = {
    search: "Cafe",
    reason: "abuse",
    ordering: "oldest",
    page: 2,
    page_size: 10,
  };
  apiClient.get = async (...args) => {
    calls.push(args);
    return { data: { data: { items: [], pagination: { page: 2 } } } };
  };

  const result = await service.fetchReportedReviews(params);

  assert.deepEqual(calls, [["/admin/review-reports/reviews/", { params }]]);
  assert.equal(result.pagination.page, 2);
});

test("detail loads one reported review group", async () => {
  apiClient.get = async (url) => {
    assert.equal(url, "/admin/review-reports/reviews/91/");
    return { data: { data: { id: 91 } } };
  };

  assert.equal((await service.fetchReportedReview(91)).id, 91);
});

test("report decisions use the existing report-specific endpoints with notes", async () => {
  const calls = [];
  apiClient.post = async (...args) => {
    calls.push(args);
    return { data: { data: { status: "resolved" } } };
  };

  await service.decideReviewReport(11, "dismiss", "No violation found on inspection.");
  await service.decideReviewReport(12, "confirm", "Confirmed violation in review content.");

  assert.deepEqual(calls, [
    ["/admin/review-reports/11/reject/", { admin_notes: "No violation found on inspection." }],
    ["/admin/review-reports/12/approve/", { admin_notes: "Confirmed violation in review content." }],
  ]);
});
