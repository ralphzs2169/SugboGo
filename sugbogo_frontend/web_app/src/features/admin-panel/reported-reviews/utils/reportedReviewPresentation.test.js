import assert from "node:assert/strict";
import { test } from "node:test";

import {
  nextReportedSelection,
  pendingReasons,
} from "./reportedReviewPresentation.js";

test("reason badges include only currently pending reason groups", () => {
  assert.deepEqual(
    pendingReasons({ spam: 2, abuse: 0, misinformation: 1, other: 0 }),
    [["spam", "Spam"], ["misinformation", "Misinformation"]],
  );
});

test("refresh keeps a surviving selection and picks an adjacent group after removal", () => {
  const before = [{ id: 1 }, { id: 2 }, { id: 3 }];
  assert.equal(nextReportedSelection(before, before, 2), 2);
  assert.equal(nextReportedSelection(before, [{ id: 1 }, { id: 3 }], 2), 3);
  assert.equal(nextReportedSelection(before, [{ id: 1 }], 3), 1);
  assert.equal(nextReportedSelection(before, [], 2), null);
});
