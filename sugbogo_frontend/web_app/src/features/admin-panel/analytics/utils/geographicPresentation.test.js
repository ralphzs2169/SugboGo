import assert from "node:assert/strict";
import { test } from "node:test";
import { geographicAreaRows, geographicExclusionLabel, geographicOpacity, geographicRanges } from "./geographicPresentation.js";

test("geographic exact values use readable area and exclusion labels without changing observations", () => {
  const cells = [{ id: "internal-grid:1:2", profile_visits: 0 }, { id: "internal-grid:2:3", profile_visits: null }];
  const rows = geographicAreaRows(cells);
  assert.deepEqual(rows.map((row) => row.area_label), ["Area 1", "Area 2"]);
  assert.equal(rows[0].id, cells[0].id);
  assert.equal(rows[0].profile_visits, 0);
  assert.equal(rows[1].profile_visits, null);
  assert.equal(cells[0].area_label, undefined);
  assert.equal(geographicExclusionLabel("missing_location"), "Missing location");
  assert.equal(geographicExclusionLabel("unsupported_srid"), "Unsupported location format");
});

test("geographic legends use distinct count ranges for each metric", () => {
  const cells = [{ eligible_businesses: 8, profile_visits: 125 }];
  const businesses = geographicRanges(cells, "eligible_businesses");
  assert.deepEqual(businesses.map((range) => range.label), ["1–2", "3–4", "5–6", "7–8"]);
  const visits = geographicRanges(cells, "profile_visits");
  assert.deepEqual(visits.map((range) => range.label), ["1–32", "33–64", "65–96", "97–125"]);
  assert.equal(geographicOpacity(8, businesses), businesses.at(-1).opacity);
});

test("zero and unavailable counts create no fabricated intensity ranges", () => {
  assert.deepEqual(geographicRanges([{ profile_visits: null }, { profile_visits: 0 }], "profile_visits"), []);
  assert.equal(geographicOpacity(0, []), 0);
  assert.equal(geographicOpacity(null, []), 0.3);
  assert.deepEqual(geographicRanges([{ eligible_businesses: 1 }], "eligible_businesses").map((range) => range.label), ["1"]);
});
