import Button from "@/shared/components/Button";

function AdminDecision({ review, onDecision, pending }) {
  const alreadyRejected = review.status === "rejected";

  return (
    <section
      aria-label="Admin decision"
      className="sticky bottom-0 z-20 border-t border-stroke bg-background px-5 py-3.5 sm:px-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        {/* Decision context */}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text-primary">
            Admin Decision
          </h3>

          <p className="mt-0.5 max-w-2xl text-xs leading-5 text-text-secondary">
            {alreadyRejected
              ? `This review is already rejected. Decide whether its ${
                  review.pending_report_count
                } remaining pending ${
                  review.pending_report_count === 1
                    ? "report should"
                    : "reports should"
                } be confirmed or dismissed. The review status will not change.`
              : `Decide whether this review should remain published. All ${
                  review.pending_report_count
                } pending ${
                  review.pending_report_count === 1
                    ? "report will"
                    : "reports will"
                } be resolved together.`}
          </p>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          {alreadyRejected ? (
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => onDecision(review, "dismiss")}
            >
              Dismiss Reports
            </Button>
          ) : (
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => onDecision(review, "keep")}
            >
              Keep Review
            </Button>
          )}

          <Button
            variant={alreadyRejected ? "primary" : "danger-outline"}
            disabled={pending}
            onClick={() =>
              onDecision(review, alreadyRejected ? "confirm" : "reject")
            }
          >
            {alreadyRejected ? "Confirm Reports" : "Reject Review"}
          </Button>
        </div>
      </div>
    </section>
  );
}

export default AdminDecision;
