import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appendAssessmentTemplate,
  duplicateAssessmentTemplates,
} from "./duplicateAssessmentTemplates.js";
test("quick notes append without overwriting existing input or repeating a template", () => {
  const template = duplicateAssessmentTemplates.legitimate[0][1];
  const appended = appendAssessmentTemplate("Verified unit 4B.", template);
  assert.equal(appended, `Verified unit 4B.\n${template}`);
  assert.equal(appendAssessmentTemplate(appended, template), appended);
  assert.equal(appendAssessmentTemplate("", template), template);
});
test("quick notes respect the explanation limit and cover all assessment types", () => {
  assert.equal(
    appendAssessmentTemplate("x".repeat(3999), "Note"),
    "x".repeat(3999),
  );
  assert.deepEqual(Object.keys(duplicateAssessmentTemplates).sort(), [
    "confirmed_duplicate",
    "legitimate",
    "ownership_conflict",
    "unresolved",
  ]);
});
