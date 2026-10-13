import ReportRow from "./ReportRow";

function IndividualReports({ review }) {
  const pending = review.reports?.filter((report) => report.status === "pending") ?? [];
  const resolved = review.reports?.filter((report) => report.status !== "pending") ?? [];

  return (
    <section aria-label="Individual reports" className="border-t border-stroke pt-5">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-base font-semibold text-text-primary">Individual Reports</h3>
        <span className="text-xs text-text-secondary">
          {review.reports?.length ?? 0} {review.reports?.length === 1 ? "report" : "reports"}
        </span>
      </div>
      <p className="mt-1 text-sm text-text-secondary">
        Community reports submitted about this review.
      </p>
      <div className="mt-4 divide-y divide-stroke overflow-hidden rounded-lg border border-stroke bg-background">
        {pending.map((report) => (
          <ReportRow key={report.id} report={report} />
        ))}
        {resolved.length > 0 && (
          <div className="bg-surface-muted px-4 py-2 text-xs font-semibold text-text-secondary">
            Previous Decisions
          </div>
        )}
        {resolved.map((report) => (
          <ReportRow key={report.id} report={report} resolved />
        ))}
      </div>
    </section>
  );
}

export default IndividualReports;
