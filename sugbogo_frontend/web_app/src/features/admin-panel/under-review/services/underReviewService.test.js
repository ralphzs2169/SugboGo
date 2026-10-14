import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "vite";

let server;
let apiClient;
let service;
let presentation;
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
    "/src/features/admin-panel/under-review/services/underReviewService.js",
  );
  presentation = await server.ssrLoadModule(
    "/src/features/admin-panel/under-review/utils/underReviewPresentation.js",
  );
  originalGet = apiClient.get;
  originalPost = apiClient.post;
});

test("a resolved queue item selects an adjacent review", () => {
  const reviews = [{ id: 1 }, { id: 2 }, { id: 3 }];

  assert.equal(presentation.nextReviewId(reviews, 2), 3);
  assert.equal(presentation.nextReviewId(reviews, 3), 2);
  assert.equal(presentation.nextReviewId([{ id: 2 }], 2), null);
});

after(async () => {
  if (apiClient) {
    apiClient.get = originalGet;
    apiClient.post = originalPost;
  }
  await server?.close();
});

test("queue forwards server search, filters, sort, and pagination", async () => {
  const calls = [];
  const params = {
    search: "Cebu",
    reason: "image_flagged",
    content: "has_photos",
    ordering: "newest",
    page: 2,
    page_size: 10,
  };
  apiClient.get = async (...args) => {
    calls.push(args);
    return { data: { data: { items: [], pagination: { page: 2 } } } };
  };

  const result = await service.fetchUnderReviewReviews(params);

  assert.deepEqual(calls, [["/admin/under-review/", { params }]]);
  assert.equal(result.pagination.page, 2);
});

test("detail and decisions use the held-review Admin endpoints", async () => {
  const calls = [];
  apiClient.get = async (...args) => {
    calls.push(["get", ...args]);
    return { data: { data: { id: 42 } } };
  };
  apiClient.post = async (...args) => {
    calls.push(["post", ...args]);
    return { data: { data: { id: 42 } } };
  };

  await service.fetchUnderReviewReview(42);
  await service.approveUnderReviewReview(42);
  await service.rejectUnderReviewReview(42, "The review contains threatening content.");

  assert.deepEqual(calls, [
    ["get", "/admin/under-review/42/"],
    ["post", "/admin/under-review/42/approve/"],
    ["post", "/admin/under-review/42/reject/", {
      moderation_notes: "The review contains threatening content.",
    }],
  ]);
});
