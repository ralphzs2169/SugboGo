import { useParams, useNavigate } from "react-router-dom";

import useDocumentTitle from "@/shared/hooks/useDocumentTitle";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";

import PageHeader from "../components/PageHeader";
import useReviewDisputeDetail from "../review-disputes/hooks/useReviewDisputeDetail";

export default function ReviewDisputeDetailPage() {
  const { disputeId } = useParams();
  const navigate = useNavigate();

  useDocumentTitle("Review Dispute | SugboGo Admin");

  const { dispute, isLoading, isFetching, error, refetch } =
    useReviewDisputeDetail(disputeId);

  useApiErrorNotification(error, {
    toastId: `review-dispute-${disputeId}-load-error`,
    fallbackMessage: "Unable to load the review dispute. Please try again.",
  });

  if (isLoading) {
    return (
      <>
        {/* Page header */}
        <PageHeader
          breadcrumbs={[
            {
              label: "SugboGo Admin",
              href: "/admin-panel",
            },
            {
              label: "Moderation",
            },
            {
              label: "Review Disputes",
              href: "/admin-panel/review-disputes",
            },
            {
              label: "Review",
            },
          ]}
          title="Review Dispute"
        />

        {/* Loading state */}
        <div className="rounded-lg border border-stroke bg-background p-8">
          <div className="space-y-4">
            <div className="h-5 w-48 animate-pulse rounded bg-surface-secondary" />
            <div className="h-32 animate-pulse rounded bg-surface-secondary" />
            <div className="h-48 animate-pulse rounded bg-surface-secondary" />
          </div>
        </div>
      </>
    );
  }

  if (error || !dispute) {
    return (
      <>
        {/* Page header */}
        <PageHeader
          breadcrumbs={[
            {
              label: "SugboGo Admin",
              href: "/admin-panel",
            },
            {
              label: "Moderation",
            },
            {
              label: "Review Disputes",
              href: "/admin-panel/review-disputes",
            },
            {
              label: "Review",
            },
          ]}
          title="Review Dispute"
        />

        {/* Error state */}
        <div className="rounded-lg border border-stroke bg-background p-8 text-center">
          <h2 className="text-sm font-bold text-text-primary">
            Unable to load review dispute
          </h2>

          <p className="mt-1 text-sm text-text-secondary">
            The requested dispute could not be loaded.
          </p>

          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 cursor-pointer text-sm font-semibold text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Page header */}
      <PageHeader
        breadcrumbs={[
          {
            label: "SugboGo Admin",
            href: "/admin-panel",
          },
          {
            label: "Moderation",
          },
          {
            label: "Review Disputes",
            href: "/admin-panel/review-disputes",
          },
          {
            label: `Dispute #${dispute.id}`,
          },
        ]}
        title={`Review Dispute #${dispute.id}`}
      />

      {/* Case content */}
      <div className="space-y-6">
        {/* Dispute overview */}
        <section>
          <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-text-secondary">
            Dispute
          </h2>

          <div className="rounded-lg border border-stroke bg-background p-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Reason
                </p>

                <p className="mt-1 text-sm font-semibold capitalize text-text-primary">
                  {dispute.reason?.replaceAll("_", " ") || "—"}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Status
                </p>

                <p className="mt-1 text-sm font-semibold capitalize text-text-primary">
                  {dispute.status?.replaceAll("_", " ") || "—"}
                </p>
              </div>

              <div className="lg:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Merchant Explanation
                </p>

                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-primary">
                  {dispute.description || "No description provided."}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Original review */}
        <section>
          <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-text-secondary">
            Original Review
          </h2>

          <div className="rounded-lg border border-stroke bg-background p-6">
            <p className="text-sm leading-6 text-text-primary">
              {dispute.review?.text || "No review content available."}
            </p>
          </div>
        </section>

        {/* Evidence */}
        <section>
          <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-text-secondary">
            Evidence
          </h2>

          <div className="rounded-lg border border-stroke bg-background p-6">
            {dispute.evidence?.length ? (
              <div className="space-y-3">
                {dispute.evidence.map((evidence) => (
                  <a
                    key={evidence.id}
                    href={evidence.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block cursor-pointer rounded-lg border border-stroke p-4 hover:bg-surface-secondary"
                  >
                    <p className="text-sm font-semibold capitalize text-text-primary">
                      {evidence.type?.replaceAll("_", " ") || "Evidence"}
                    </p>

                    <p className="mt-1 text-xs text-text-secondary">
                      Submitted {evidence.created_at}
                    </p>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-secondary">
                No evidence was submitted.
              </p>
            )}
          </div>
        </section>
      </div>

      {isFetching && (
        <p className="mt-4 text-xs text-text-secondary">
          Updating dispute information...
        </p>
      )}
    </>
  );
}
