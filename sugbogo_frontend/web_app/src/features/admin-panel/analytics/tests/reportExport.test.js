import assert from "node:assert/strict";
import { test } from "node:test";
import { collectAttentionPages, reportCsv, reportRecords } from "../utils/reportExport.js";

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

test("disputes CSV distinguishes all-time missing timestamps from selected-period resolutions", () => {
  const report = { completed_dispute_turnaround: { median_hours: 1.123456, missing_resolution_timestamp_count: 3 } };
  const csv = reportCsv("Reports & disputes", report, reportRecords("Reports & disputes", report));
  const rows = csv.split("\r\n");
  assert.match(rows.find((row) => row.includes("Missing resolution dates")), /all time.*All retained records; selected dates do not filter these counts/);
  assert.match(rows.find((row) => row.includes("Median resolution hours")), /1\.123456.*Selected reporting period/);
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

test("attention CSV retrieves every filtered page and retains parameters", async () => {
  const calls = [];
  const report = await collectAttentionPages(async (params) => {
    calls.push(params);
    return { items: [{ business_id: params.page, profile_visits: params.page }], pagination: { total_items: 2, total_pages: 2, has_next: params.page === 1 } };
  }, { category: 4, attention_mode: "discovery", period: "90" });
  assert.deepEqual(report.items.map((row) => row.business_id), [1, 2]);
  assert.ok(calls.every((params) => params.category === 4 && params.period === "90" && params.page_size === 100));
});

test("partial, unavailable and changing pagination cannot silently export a page", async () => {
  await assert.rejects(collectAttentionPages(async () => ({ items: [{ business_id: 1 }], pagination: { total_items: 2, total_pages: 1, has_next: false } }), {}), /complete report/);
  await assert.rejects(collectAttentionPages(async () => ({ items: null, pagination: null }), {}), /unavailable/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(collectAttentionPages(async () => ({}), {}, controller.signal), /cancelled/);
  assert.deepEqual(reportRecords("Platform Growth", { meta: { availability: "unavailable" }, series: [{ count: 1 }] }, [{ key: "count", label: "Accounts" }]), []);
  assert.deepEqual(reportRecords("Specialty Support", { top_supported_specialties: [{ name: "Only a preview", valid_vouches: 2 }] }), []);
  await assert.rejects(collectAttentionPages(async (params) => ({ items: [{ business_id: 1 }], pagination: { total_items: 2, total_pages: 2, has_next: params.page === 1 } }), {}), /changed during export/);
});

test("export datasets keep complete dimensions and never substitute bounded previews", () => {
  const coverage = reportRecords("Business Coverage", { overall: { eligible_businesses: 3 }, categories: [{ name: "A", coverage_percentage: 36.363636 }], clusters: [{ name: "B", eligible_businesses: 3 }] });
  assert.deepEqual([...new Set(coverage.map((row) => row[0]))], ["Overall", "Categories", "Clusters"]);
  assert.equal(coverage.find((row) => row[1] === "A")[3], 36.363636);
  const transport = reportRecords("Transportation Planning", { methods: [{ label: "Other", count: 0, share_percent: 0 }], series: [{ date: "2026-11-01", road_route: 1 }], destinations: [{ business_name: "Bounded preview", count: 99 }] });
  assert.ok(transport.some((row) => row[1] === "Other" && row[3] === 0));
  assert.ok(transport.every((row) => row[1] !== "Bounded preview"));
  assert.deepEqual(reportRecords("Business Acquisition", { categories: [{ name: "Legacy partial breakdown", created: 1 }] }), []);
  const specialties = reportRecords("Specialty Support", { specialties: [{ name: "Complete row", valid_vouches: 2 }], top_supported_specialties: [{ name: "Preview", valid_vouches: 99 }] });
  assert.ok(specialties.some((row) => row[1] === "Complete row"));
  assert.ok(specialties.every((row) => row[1] !== "Preview"));
});
