import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appendQuickReason,
  duplicateRejectionReasons,
} from "./rejectionFeedback.utils.js";
test("merchant-safe quick reasons populate or append without replacing manual input", () => {
  const message = duplicateRejectionReasons[0].message;
  assert.equal(appendQuickReason("", message), message);
  assert.equal(
    appendQuickReason("Manual explanation", message),
    `Manual explanation\n${message}`,
  );
  const edited = "Administrator freely revised the generated explanation.";
  assert.equal(appendQuickReason(edited, message), `${edited}\n${message}`);
  assert.equal(
    appendQuickReason("x".repeat(3999), message, 4000),
    "x".repeat(3999),
  );
});
