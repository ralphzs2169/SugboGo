import test from "node:test";
import assert from "node:assert/strict";

import { adminBusinessUpdateRequestKeys } from "./businessUpdateRequestQueryKeys.js";
import { adminClassificationUpdateRequestKeys } from "./classificationUpdateRequestQueryKeys.js";
import { adminLocationUpdateRequestKeys } from "./locationUpdateRequestQueryKeys.js";

test("same numeric ID uses a separate detail resource for each request type", () => {
  const locationKey = adminLocationUpdateRequestKeys.detail(3);
  assert.notDeepEqual(locationKey, adminBusinessUpdateRequestKeys.detail(3));
  assert.notDeepEqual(
    locationKey,
    adminClassificationUpdateRequestKeys.detail(3),
  );
});

test("location list keys preserve independent status and page filters", () => {
  const pending = adminLocationUpdateRequestKeys.list({
    status: "pending",
    page: 1,
  });
  const approved = adminLocationUpdateRequestKeys.list({
    status: "approved",
    page: 1,
  });
  const secondPage = adminLocationUpdateRequestKeys.list({
    status: "pending",
    page: 2,
  });
  assert.notDeepEqual(pending, approved);
  assert.notDeepEqual(pending, secondPage);
});

test("combined queue keys share one invalidation prefix", () => {
  const page = adminBusinessUpdateRequestKeys.combinedList({
    status: "pending",
    requestType: "all",
    page: 2,
  });

  assert.deepEqual(
    page.slice(0, adminBusinessUpdateRequestKeys.combinedLists.length),
    adminBusinessUpdateRequestKeys.combinedLists,
  );
});
