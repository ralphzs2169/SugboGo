import Button from "@/shared/components/Button";

function AdminDecision({ review, onDecision, pending }) {
  const alreadyRejected = review.status === "rejected";

  return (
    <section aria-label="Admin decision" className="border-t border-stroke pt-6">
      <h3 className="text-base font-semibold text-text-primary">Admin Decision</h3>
      <p className="mt-1 text-sm text-text-secondary">
        {alreadyRejected
          ? `This review is already rejected. Decide whether its ${review.pending_report_count} remaining pending ${review.pending_report_count === 1 ? "report should" : "reports should"} be confirmed or dismissed. Its status will not change.`
          : `Decide whether this review should remain published. All ${review.pending_report_count} pending ${review.pending_report_count === 1 ? "report will" : "reports will"} be resolved together.`}
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        {alreadyRejected ? (
          <Button variant="secondary" className="min-h-11" disabled={pending} onClick={() => onDecision(review, "dismiss")}>
            Dismiss Reports
          </Button>
        ) : (
          <Button variant="secondary" className="min-h-11" disabled={pending} onClick={() => onDecision(review, "keep")}>
            Keep Review
          </Button>
        )}
        <Button variant={alreadyRejected ? "primary" : "danger-outline"} className="min-h-11" disabled={pending} onClick={() => onDecision(review, alreadyRejected ? "confirm" : "reject")}>
          {alreadyRejected ? "Confirm Reports" : "Reject Review"}
        </Button>
      </div>
    </section>
  );
}

export default AdminDecision;
