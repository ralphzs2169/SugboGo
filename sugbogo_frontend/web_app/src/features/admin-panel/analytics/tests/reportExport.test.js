import assert from "node:assert/strict";
import { test } from "node:test";
import { reportCsv, reportRecords } from "../utils/reportExport.js";

test("geographic CSV uses the drawer's area labels and preserves zero and unavailable visits", () => {
  const report = {
    cells: [
      { id: "internal-grid:1:2", eligible_businesses: 1, profile_visits: 0 },
      { id: "internal-grid:2:3", eligible_businesses: 2, profile_visits: null },
    ],
    reconciliation: { excluded_by_reason: { unsupported_srid: { businesses: 1, profile_visits: null } } },
  };
  const records = reportRecords("Geographic Distribution", report);
  assert.deepEqual(records.filter((row) => row[2] === "Recorded profile visits").map((row) => row.slice(1)), [
    ["Area 1", "Recorded profile visits", 0],
    ["Area 2", "Recorded profile visits", null],
  ]);
  const csv = reportCsv("Geographic Distribution", report, records);
  assert.doesNotMatch(csv, /internal-grid|unsupported_srid/);
  assert.match(csv, /Unsupported location format/);
});

test("CSV preserves source precision, zero and unavailable values with safe quoting", () => {
  const report = { meta: { period: { start_date: "2026-10-02", end_date: "2026-10-31" } }, series: [{ date: "2026-10-02", count: 36.363636, zero: 0, unknown: null }] };
  const records = reportRecords("Platform Growth", report, [{ key: "count", label: "Accounts" }, { key: "zero", label: "Businesses" }, { key: "unknown", label: "Unknown" }]);
  const csv = reportCsv("Platform Growth", report, [...records, ["Names", '=SUM(1,2)', 'A "quote"', 1]], { Category: "All" });
  assert.match(csv, /36\.363636/);
  assert.match(csv, /"0"/);
  assert.match(csv, /"Unavailable"/);
  assert.match(csv, /'=SUM\(1,2\)/);
  assert.match(csv, /A ""quote""/);
  assert.match(csv, /2026-10-02/);
  assert.equal(report.series[0].unknown, null);
});

test("first profile visit source CSV keeps the recorded counts and shares under the new title", () => {
  const title = "First Profile Visit Source";
  const report = { sources: [{ label: "Search", count: 4, share_percent: 80 }, { label: "Unknown", count: 1, share_percent: 20 }] };
  const records = reportRecords(title, report);
  assert.deepEqual(records.map((row) => row.slice(1)), [
    ["Search", "Recorded visits", 4],
    ["Search", "Share (%)", 80],
    ["Unknown", "Recorded visits", 1],
    ["Unknown", "Share (%)", 20],
  ]);
  assert.match(reportCsv(title, report, records), /"First Profile Visit Source"/);
});

test("export datasets never substitute bounded previews", () => {
  assert.deepEqual(reportRecords("Platform Growth", { meta: { availability: "unavailable" }, series: [{ count: 1 }] }, [{ key: "count", label: "Accounts" }]), []);
  assert.deepEqual(reportRecords("Specialty Support", { top_supported_specialties: [{ name: "Only a preview", valid_vouches: 2 }] }), []);
  const transport = reportRecords("Transportation Planning", { methods: [{ label: "Other", count: 0, share_percent: 0 }], series: [{ date: "2026-11-01", road_route: 1 }], destinations: [{ business_name: "Bounded preview", count: 99 }] });
  assert.ok(transport.some((row) => row[1] === "Other" && row[3] === 0));
  assert.ok(transport.every((row) => row[1] !== "Bounded preview"));
  const specialties = reportRecords("Specialty Support", { specialties: [{ name: "Complete row", valid_vouches: 2 }], top_supported_specialties: [{ name: "Preview", valid_vouches: 99 }] });
  assert.ok(specialties.some((row) => row[1] === "Complete row"));
  assert.ok(specialties.every((row) => row[1] !== "Preview"));
});
