import assert from "node:assert/strict";
import test from "node:test";

import {
  combineUpdateRequests,
  fetchSourceRequests,
} from "./combineUpdateRequests.js";

function request(type, id, submittedAt, status = "approved") {
  return {
    id,
    request_type: type,
    status,
    submitted_at: submittedAt,
    current_business_name: `Business ${id}`,
    business_id: id,
    merchant: { name: `Merchant ${id}`, email: `merchant${id}@example.com` },
  };
}

test("combined pages preserve pending-first ordering and exact totals", () => {
  const sources = [
    {
      total: 2,
      items: [
        request("business_name", 1, "2026-10-01T10:00:00Z", "pending"),
        request("business_name", 2, "2026-10-04T10:00:00Z"),
      ],
    },
    {
      total: 1,
      items: [request("location", 3, "2026-10-03T10:00:00Z", "pending")],
    },
  ];

  const first = combineUpdateRequests(sources, {
    search: "",
    page: 1,
    pageSize: 2,
  });
  const second = combineUpdateRequests(sources, {
    search: "",
    page: 2,
    pageSize: 2,
  });

  assert.deepEqual(
    first.items.map((item) => item.id),
    [3, 1],
  );
  assert.deepEqual(
    second.items.map((item) => item.id),
    [2],
  );
  assert.equal(first.totalItems, 3);
  assert.equal(first.pageCount, 2);
});

test("search filters actual business, requester, and request type fields", () => {
  const sources = [
    {
      total: 2,
      items: [
        request("business_name", 1, "2026-10-01T10:00:00Z"),
        request("location", 2, "2026-10-02T10:00:00Z"),
      ],
    },
  ];

  const result = combineUpdateRequests(sources, {
    search: "location",
    page: 1,
    pageSize: 10,
  });

  assert.deepEqual(
    result.items.map((item) => item.id),
    [2],
  );
  assert.equal(result.totalItems, 1);
});

test("combined pagination fetches later source pages when needed", async () => {
  const fetchedPages = [];
  const fetchPage = async ({ page, page_size: pageSize }) => {
    fetchedPages.push(page);
    return {
      items: Array.from({ length: page === 1 ? pageSize : 10 }, (_, index) => ({
        id: (page - 1) * pageSize + index + 1,
      })),
      pagination: { total_items: 110 },
    };
  };

  const result = await fetchSourceRequests(fetchPage, "pending", 11, 10, false);

  assert.deepEqual(fetchedPages, [1, 2]);
  assert.equal(result.items.length, 110);
  assert.equal(result.total, 110);
});
