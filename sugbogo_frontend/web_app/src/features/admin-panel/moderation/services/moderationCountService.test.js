import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "vite";

let server;
let apiClient;
let fetchModerationTabCount;
let originalGet;

before(async () => {
  server = await createServer({
    appType: "custom",
    server: { middlewareMode: true },
  });
  ({ default: apiClient } = await server.ssrLoadModule(
    "/src/shared/api/apiClient.js",
  ));
  ({ fetchModerationTabCount } = await server.ssrLoadModule(
    "/src/features/admin-panel/moderation/services/moderationCountService.js",
  ));
  originalGet = apiClient.get;
});

after(async () => {
  if (apiClient) {
    apiClient.get = originalGet;
  }
  await server?.close();
});

test("tab counts use each queue's unfiltered paginated total", async () => {
  const calls = [];
  const totals = [8, 12, 5, 2, 3];
  apiClient.get = async (url, options) => {
    calls.push([url, options.params]);
    return {
      data: {
        data: {
          items: [],
          pagination: { total_items: totals[calls.length - 1] },
        },
      },
    };
  };

  const counts = [];
  for (const tab of ["under-review", "suspicious", "reported", "disputes"]) {
    counts.push(await fetchModerationTabCount(tab));
  }

  assert.deepEqual(counts, [8, 17, 2, 3]);
  assert.deepEqual(calls, [
    ["/admin/under-review/", { page: 1, page_size: 1 }],
    ["/admin/suspicious-reviews/", { page: 1, page_size: 1 }],
    ["/admin/suspicious-vouches/", { page: 1, page_size: 1 }],
    ["/admin/review-reports/reviews/", { page: 1, page_size: 1 }],
    ["/admin/review-disputes/", { page: 1, page_size: 1, status: "pending" }],
  ]);
});

test("suspicious combined count rejects unavailable or invalid vouch totals", async () => {
  apiClient.get = async (url) => {
    if (url === "/admin/suspicious-vouches/") {
      throw new Error("Vouch count unavailable");
    }
    return { data: { data: { pagination: { total_items: 12 } } } };
  };
  await assert.rejects(fetchModerationTabCount("suspicious"), /unavailable/);
  apiClient.get = async (url) => ({
    data: { data: { pagination: { total_items: url.includes("vouches") ? undefined : 12 } } },
  });
  await assert.rejects(fetchModerationTabCount("suspicious"), /unavailable/);
});

test("zero is a valid queue count and missing totals are errors", async () => {
  apiClient.get = async () => ({
    data: { data: { items: [], pagination: { total_items: 0 } } },
  });
  assert.equal(await fetchModerationTabCount("reported"), 0);

  apiClient.get = async () => ({
    data: { data: { items: [], pagination: {} } },
  });
  await assert.rejects(
    fetchModerationTabCount("reported"),
    /count is unavailable/,
  );
});
