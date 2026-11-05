import Button from "@/shared/components/Button";
import Modal from "@/shared/components/modals/Modal";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import { formatTimestamp } from "../../analytics/utils/presentation";
import { formatScore } from "../utils/presentation";
import useDiscoveryScoreDetails from "../hooks/useDiscoveryScoreDetails";
import RefreshStatusBadge from "./RefreshStatusBadge";
import { VisibilityDiagnosticContent } from "./VisibilityDiagnosticsModal";

const dateLabel = (value) => value ? `${formatTimestamp(value)} · PHT` : "Unavailable";

/** Keep score values and current-configuration contributions separate from historical claims. */
export function DiscoveryScoreDetailContent({ query }) {
  const { data, error, isFetching, isLoading, refetch } = query;
  if (isLoading && !data) {
    return <p role="status" aria-busy="true" className="text-sm text-text-secondary">Loading score breakdown…</p>;
  }

  const breakdown = data?.score_breakdown;
  const tags = data?.business?.specialty_tags ?? [];
  return (
    <div className="space-y-5" aria-busy={isFetching}>
      {error && (
        <DataErrorState
          compact framed retainedData={Boolean(data)}
          title="Unable to load score details"
          message={error.response?.data?.message || "Score details are currently unavailable."}
          onRetry={() => refetch()} retrying={isFetching} retryLabel="Retry score details"
        />
      )}
      {!data && !error && (
        <div className="space-y-3 text-sm text-text-secondary">
          <p>No score details returned.</p>
          <Button variant="secondary" onClick={() => refetch()} loading={isFetching}>Retry score details</Button>
        </div>
      )}
      {data && (
        <>
          <section aria-label="Score breakdown" className="space-y-4">
            <h3 className="text-base font-semibold text-text-primary">Score Breakdown</h3>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                ["Specialty Score", data.specialty_score],
                ["Visibility Gap", data.visibility_gap],
                ["Discovery Score", data.discovery_score],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-stroke bg-surface p-3">
                  <dt className="text-xs text-text-secondary">{label}</dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums text-text-primary">{formatScore(value)}</dd>
                </div>
              ))}
            </dl>
            {data.is_provisional && <p className="text-sm text-warning">Provisional baseline · No successful computation yet.</p>}
            <div className="rounded-lg border border-info/20 bg-info/5 p-4 text-sm text-text-secondary">
              <h4 className="font-semibold text-text-primary">Current-configuration contributions</h4>
              <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                <div><dt>Weighted specialty contribution</dt><dd className="font-semibold tabular-nums text-text-primary">{formatScore(breakdown?.weighted_specialty_contribution)}</dd></div>
                <div><dt>Weighted visibility contribution</dt><dd className="font-semibold tabular-nums text-text-primary">{formatScore(breakdown?.weighted_visibility_contribution)}</dd></div>
              </dl>
              <p className="mt-3 text-xs leading-5">{breakdown?.note || "Current weights apply to stored components. Historical weights and observation windows were not persisted; these values do not reconstruct a past calculation."}</p>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-text-primary">Current specialty tags</h4>
              {tags.length ? (
                <ul className="divide-y divide-stroke rounded-lg border border-stroke">
                  {tags.map((tag) => (
                    <li key={tag.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <SpecialtyTagChip tag={tag} size="small" />
                      <span className="text-sm tabular-nums text-text-primary">{formatScore(tag.tag_score)}</span>
                      <span className="w-full text-xs text-text-secondary">Score updated: {dateLabel(tag.score_updated_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-text-secondary">No current specialty tags.</p>}
            </div>
          </section>
          <section aria-label="Computation information" className="space-y-3 border-t border-stroke pt-5">
            <h3 className="text-base font-semibold text-text-primary">Computation Information</h3>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div><dt className="text-text-secondary">Last successful computation</dt><dd className="mt-1 text-text-primary">{data.computed_at ? dateLabel(data.computed_at) : "Not yet computed"}</dd></div>
              <div><dt className="text-text-secondary">Latest refresh status</dt><dd className="mt-1"><RefreshStatusBadge status={data.refresh_status} /></dd></div>
              <div><dt className="text-text-secondary">Most recent attempt</dt><dd className="mt-1 text-text-primary">{dateLabel(data.last_attempt_at)}</dd></div>
              <div><dt className="text-text-secondary">Refresh requested</dt><dd className="mt-1 text-text-primary">{dateLabel(data.refresh_requested_at)}</dd></div>
              <div><dt className="text-text-secondary">Stored score state</dt><dd className="mt-1 text-text-primary">{data.score_state || "Unavailable"}</dd></div>
              <div><dt className="text-text-secondary">Latest refresh error</dt><dd className="mt-1 break-words text-text-primary">{data.last_error_code || "None reported"}</dd></div>
            </dl>
            {data.refresh_status === "FAILED" && data.computed_at && (
              <p className="text-xs text-text-secondary">The latest refresh failed. The last successfully computed score remains available above.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/** Load persisted details and visibility independently for the explicitly selected business. */
export default function DiscoveryScoreDetailsModal({ business, onClose }) {
  const { detail, diagnostic } = useDiscoveryScoreDetails(business.id);
  useApiErrorNotification(detail.error, {
    toastId: `discovery-score-detail-${business.id}`,
    fallbackMessage: "Unable to load score details. Please try again.",
  });
  useApiErrorNotification(diagnostic.error, {
    toastId: `discovery-score-diagnostic-${business.id}`,
    fallbackMessage: "Unable to load visibility diagnostics. Please try again.",
  });

  return (
    <Modal isOpen onClose={onClose} title={`Discovery Score · ${business.business_name}`} description="Stored scores and current visibility diagnostics · PHT" maxWidth="max-w-3xl" scrollable>
      <div className="space-y-6">
        <DiscoveryScoreDetailContent query={detail} />
        <section aria-label="Visibility diagnostics" className="space-y-3 border-t border-stroke pt-5">
          <h3 className="text-base font-semibold text-text-primary">Visibility Diagnostics</h3>
          <p className="text-xs leading-5 text-text-secondary">Current diagnostic calculation. Newer events, group membership, or configuration may differ from the stored result. This does not reproduce a historical score or update ranking.</p>
          <VisibilityDiagnosticContent query={diagnostic} />
        </section>
      </div>
    </Modal>
  );
}
