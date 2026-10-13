import assert from "node:assert/strict";
import { test } from "node:test";

import {
  nextReportedSelection,
  pendingReasons,
} from "./reportedReviewPresentation.js";

test("reason badges include only currently pending reason groups", () => {
  assert.deepEqual(
    pendingReasons({ spam: 2, abuse: 0, misinformation: 1, other: 0 }),
    [["spam", "Spam"], ["misinformation", "False or Misleading Information"]],
  );
});

test("all six report reasons retain their stored values and display labels", () => {
  assert.deepEqual(
    pendingReasons({
      spam: 1,
      abuse: 1,
      misinformation: 1,
      off_topic: 1,
      private_information: 1,
      other: 1,
    }),
    [
      ["spam", "Spam"],
      ["abuse", "Abuse or Harassment"],
      ["misinformation", "False or Misleading Information"],
      ["off_topic", "Off-topic or Irrelevant"],
      ["private_information", "Personal or Private Information"],
      ["other", "Other"],
    ],
  );
});

test("refresh keeps a surviving selection and picks an adjacent group after removal", () => {
  const before = [{ id: 1 }, { id: 2 }, { id: 3 }];
  assert.equal(nextReportedSelection(before, before, 2), 2);
  assert.equal(nextReportedSelection(before, [{ id: 1 }, { id: 3 }], 2), 3);
  assert.equal(nextReportedSelection(before, [{ id: 1 }], 3), 1);
  assert.equal(nextReportedSelection(before, [], 2), null);
});
