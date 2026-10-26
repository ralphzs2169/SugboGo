import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";

import { loadTransitReferences } from "./loadTransitReferences.js";
import { transitQueryKeys } from "../hooks/transitQueryKeys.js";

function response(page, count, pageSize = 100) {
  return {
    items: Array.from({ length: Math.min(pageSize, Math.max(0, count - (page - 1) * pageSize)) }, (_, i) => ({
      id: (page - 1) * pageSize + i + 1,
    })),
    pagination: {
      page, page_size: pageSize, total_items: count,
      total_pages: Math.ceil(count / pageSize), has_next: page < Math.ceil(count / pageSize),
    },
  };
}

test("collects references beyond 100 using bounded API page requests", async () => {
  const calls = [];
  const items = await loadTransitReferences(async (params) => {
    calls.push(params);
    return response(params.page, 251);
  });
  assert.deepEqual(calls, [1, 2, 3].map((page) => ({ page, page_size: 100 })));
  assert.equal(items.length, 251);
  assert.equal(items.at(-1).id, 251);
});

test("empty datasets use the existing zero-total-pages contract", async () => {
  let calls = 0;
  assert.deepEqual(await loadTransitReferences(async ({ page }) => {
    calls += 1;
    return response(page, 0);
  }), []);
  assert.equal(calls, 1);
});

test("follows a smaller server page size instead of guessing offsets", async () => {
  const items = await loadTransitReferences(async ({ page }) => response(page, 123, 50));
  assert.equal(items.length, 123);
  assert.equal(items.at(-1).id, 123);
});

test("a later failure rejects the whole collection and retry begins at page one", async () => {
  let fail = true;
  const calls = [];
  const fetchPage = async ({ page }) => {
    calls.push(page);
    if (page === 2 && fail) throw new Error("Page two unavailable");
    return response(page, 205);
  };
  await assert.rejects(loadTransitReferences(fetchPage), /Page two unavailable/);
  fail = false;
  assert.equal((await loadTransitReferences(fetchPage)).length, 205);
  assert.deepEqual(calls, [1, 2, 1, 2, 3]);
});

test("cancellation before loading makes no request", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(loadTransitReferences(async () => { calls += 1; }, {
    signal: controller.signal,
  }), { name: "AbortError" });
  assert.equal(calls, 0);
});

test("cancellation during collection forwards the signal and stops later pages", async () => {
  const controller = new AbortController();
  const pages = [];
  await assert.rejects(loadTransitReferences(async ({ page }, { signal }) => {
    assert.equal(signal, controller.signal);
    pages.push(page);
    if (page === 2) controller.abort();
    return response(page, 251);
  }, { signal: controller.signal }), { name: "AbortError" });
  assert.deepEqual(pages, [1, 2]);
});

test("changing totals never masquerade as a complete collection", async () => {
  await assert.rejects(loadTransitReferences(async ({ page }) => response(page, page === 1 ? 201 : 202)), /changed/);
});

test("overlapping IDs are rejected instead of silently hiding a missing reference", async () => {
  await assert.rejects(loadTransitReferences(async ({ page }) => {
    const result = response(page, 101);
    if (page === 2) result.items[0].id = 1;
    return result;
  }), /duplicate IDs/);
});

test("malformed or looping pagination fails without continuing requests", async () => {
  for (const invalid of [
    null,
    { items: [], pagination: {} },
    { ...response(1, 1), pagination: { ...response(1, 1).pagination, has_next: true } },
    { ...response(1, 1), items: [] },
    { ...response(1, 1), items: [{ name: "Missing ID" }] },
    response(1, 1, 1000),
  ]) {
    let calls = 0;
    await assert.rejects(loadTransitReferences(async () => { calls += 1; return invalid; }));
    assert.equal(calls, 1);
  }
  await assert.rejects(loadTransitReferences(async ({ page }) => response(page === 2 ? 1 : page, 101)));
});

test("reference cache stays separate from browser pages and follows prefix invalidation", async () => {
  const client = new QueryClient();
  const listKey = transitQueryKeys.transitPointList({ page: 1, page_size: 10 });
  const pointKey = transitQueryKeys.transitPointReferences();
  const variantKey = transitQueryKeys.variantReferences();
  client.setQueryData(listKey, { items: [{ id: 1 }], pagination: { page: 1 } });
  client.setQueryData(pointKey, [{ id: 101 }]);
  client.setQueryData(variantKey, [{ id: 201 }]);
  await client.invalidateQueries({ queryKey: transitQueryKeys.transitPoints() });
  assert.equal(client.getQueryState(listKey).isInvalidated, true);
  assert.equal(client.getQueryState(pointKey).isInvalidated, true);
  assert.equal(client.getQueryState(variantKey).isInvalidated, false);
  await client.invalidateQueries({ queryKey: transitQueryKeys.variants() });
  assert.equal(client.getQueryState(variantKey).isInvalidated, true);
  assert.equal(client.getQueryData(pointKey)[0].id, 101);
  client.clear();
});
