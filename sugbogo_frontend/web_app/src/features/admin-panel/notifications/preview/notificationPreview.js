import { create } from "zustand";

export const PREVIEW_STATES = [
  ["live", "Live"],
  ["loading", "Loading"],
  ["empty", "Empty"],
  ["single", "One unread"],
  ["many", "Many unread (9+)"],
  ["mixed", "Mixed / paginated"],
  ["read", "All read"],
  ["error", "Request errors"],
  ["read-error", "Read action error"],
  ["marking", "Marking all read"],
];

const TARGETS = [
  ["admin_merchant_application_submitted", "admin_merchant_application", "Merchant application submitted", "Kusina Sugbo submitted an application for review."],
  ["admin_review_moderation_required", "admin_review_moderation", "Review needs moderation", "A review of Cebu Coffee needs human moderation."],
  ["admin_review_report_received", "admin_reported_review", "Review report received", "A review of Mercado Kitchen has been reported."],
  ["admin_review_dispute_filed", "admin_review_dispute", "Review dispute filed", "A merchant has disputed a review of Island Bakery."],
];
const REQUEST_ERROR = new Error("Preview request failure");
export const PREVIEW_READ_ERROR = new Error("Preview read failure");

/** Create sample inbox content without referencing real administrative records. */
function sampleRecords(scenario) {
  const length = scenario === "empty" ? 0 : scenario === "single" ? 1 : 23;
  return Array.from({ length }, (_, index) => {
    const [type, target_type, title, body] = TARGETS[index % TARGETS.length];
    const is_read = scenario === "read" || (scenario === "mixed" && index >= 12);
    const created_at = new Date(Date.now() - index * 3_600_000).toISOString();
    return {
      id: index + 1,
      type,
      target_type,
      target_id: null,
      title,
      body,
      is_read,
      read_at: is_read ? created_at : null,
      created_at,
    };
  });
}

/** Keep preview data separate from the authenticated React Query cache. */
export const useNotificationPreview = create((set) => ({
  scenario: "live",
  records: [],
  setScenario: (scenario) => set({ scenario, records: sampleRecords(scenario) }),
  markRead: (id) => set((state) => ({
    records: state.records.map((record) => (
      id === undefined || record.id === id
        ? { ...record, is_read: true, read_at: new Date().toISOString() }
        : record
    )),
  })),
}));

/** Return the query interface consumed by the existing notification surfaces. */
export function previewQuery(preview, params) {
  const pending = preview.scenario === "loading";
  const error = preview.scenario === "error" ? REQUEST_ERROR : null;
  const items = preview.records.filter((item) => params?.is_read !== false || !item.is_read);
  const page = params?.page ?? 1;
  const pageSize = params?.page_size ?? 10;
  const totalPages = Math.ceil(items.length / pageSize);
  const data = params ? {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    pagination: {
      page,
      page_size: pageSize,
      total_items: items.length,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_previous: page > 1,
    },
  } : { unread_count: preview.records.filter((item) => !item.is_read).length };
  return {
    data: pending || error ? undefined : data,
    error,
    isPending: pending,
    isFetching: pending,
    refetch: () => {
      if (error) preview.setScenario("mixed");
    },
  };
}
