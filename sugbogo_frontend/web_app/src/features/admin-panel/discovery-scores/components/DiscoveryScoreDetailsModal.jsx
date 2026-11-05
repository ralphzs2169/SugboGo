import { CalendarDays, ChartNoAxesColumn, Info, Tag, Target, Trophy } from "lucide-react";
import Button from "@/shared/components/Button";
import Modal from "@/shared/components/modals/Modal";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import StatusBadge from "@/shared/components/StatusBadge";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";
import { formatTimestamp } from "../../analytics/utils/presentation";
import { formatScore } from "../utils/presentation";
import useDiscoveryScoreDetails from "../hooks/useDiscoveryScoreDetails";
import RefreshStatusBadge from "./RefreshStatusBadge";
import ScoreDetailSection from "./ScoreDetailSection";
import { VisibilityDiagnosticContent } from "./VisibilityDiagnosticsModal";

const dateLabel = (value) => value ? `${formatTimestamp(value)} · PHT` : "Unavailable";
const weightFormatter = new Intl.NumberFormat("en-PH", { style: "percent", maximumFractionDigits: 3 });
const weightLabel = (value) => value == null ? "Unavailable" : weightFormatter.format(Number(value));
const SCORE_STATES = {
  FRESH: { label: "Fresh", variant: "success" },
  STALE: { label: "Stale", variant: "warning" },
  FAILED: { label: "Failed", variant: "danger" },
  PENDING: { label: "Pending", variant: "warning" },
  PROVISIONAL: { label: "Provisional", variant: "info" },
};

/** Keep stored scores visible while grouping optional explanations by purpose. */
export function DiscoveryScoreDetailContent({ query }) {
  const { data, error, isFetching, isLoading, refetch } = query;
  if (isLoading && !data) {
    return <p role="status" aria-busy="true" className="text-sm text-text-secondary">Loading score breakdown…</p>;
  }
  const breakdown = data?.score_breakdown;
  const tags = data?.business?.specialty_tags ?? [];
  const state = SCORE_STATES[data?.score_state];

  return (
    <div className="space-y-4" aria-busy={isFetching}>
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
                { label: "Specialty Score", value: data.specialty_score, icon: Target },
                { label: "Visibility Gap", value: data.visibility_gap, icon: ChartNoAxesColumn },
                { label: "Discovery Score", value: data.discovery_score, icon: Trophy, final: true },
              ].map(({ label, value, icon: Icon, final }) => (
                <div key={label} className={`flex items-center gap-3 rounded-lg border p-4 ${final ? "border-success/40 bg-success/5" : "border-stroke bg-surface"}`}>
                  <Icon aria-hidden="true" className={`h-5 w-5 shrink-0 ${final ? "text-success" : "text-info"}`} />
                  <div>
                    <dt className="text-xs text-text-secondary">{label}</dt>
                    <dd className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">{formatScore(value)}</dd>
                  </div>
                </div>
              ))}
            </dl>
            {data.is_provisional && <p className="text-sm text-warning">Provisional baseline · No successful computation yet.</p>}
            <div className="rounded-lg border border-stroke bg-surface p-4 text-sm text-text-secondary">
              <h4 className="flex items-center gap-2 font-semibold text-text-primary">Current-configuration contributions <Info aria-hidden="true" className="h-3.5 w-3.5" /></h4>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2 sm:divide-x sm:divide-stroke">
                {[
                  ["Weighted specialty contribution", breakdown?.specialty_weight, breakdown?.weighted_specialty_contribution],
                  ["Weighted visibility contribution", breakdown?.visibility_weight, breakdown?.weighted_visibility_contribution],
                ].map(([label, weight, value], index) => (
                  <div key={label} className={`flex flex-wrap items-center gap-2 ${index ? "sm:pl-4" : ""}`}>
                    <dt className="flex items-center gap-2"><StatusBadge variant="info">{weightLabel(weight)}</StatusBadge>{label}</dt>
                    <dd className="font-semibold tabular-nums text-text-primary">{formatScore(value)}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs leading-5">Contributions use current configuration and stored component scores. They may differ from the original calculation.</p>
              <p className="mt-1 text-xs leading-5">Historical weights and observation windows were not persisted.</p>
            </div>
          </section>
          <ScoreDetailSection title="Specialty Score Breakdown" description="Current specialty tags and their individual scores." icon={Tag} defaultExpanded>
            {tags.length ? (
              <div className="themed-scrollbar overflow-x-auto rounded-lg border border-stroke">
                <table className="w-full text-left text-sm">
                  <thead className="bg-metric-header text-xs text-text-secondary">
                    <tr>{["Specialty Tag", "Score", "Last Updated"].map((label) => <th key={label} scope="col" className="px-3 py-2 font-semibold">{label}</th>)}</tr>
                  </thead>
                  <tbody>
                    {tags.map((tag) => (
                      <tr key={tag.id} className="border-t border-stroke">
                        <td className="px-3 py-2"><SpecialtyTagChip tag={tag} size="small" /></td>
                        <td className="px-3 py-2 font-medium tabular-nums text-text-primary">{formatScore(tag.tag_score)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-text-secondary">{dateLabel(tag.score_updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-text-secondary">No current specialty tags.</p>}
          </ScoreDetailSection>
          <ScoreDetailSection title="Computation Information" description="Refresh attempts, timestamps, and score state." icon={CalendarDays}>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div><dt className="text-text-secondary">Last successful computation</dt><dd className="mt-1 text-text-primary">{data.computed_at ? dateLabel(data.computed_at) : "Not yet computed"}</dd></div>
              <div><dt className="text-text-secondary">Latest refresh status</dt><dd className="mt-1"><RefreshStatusBadge status={data.refresh_status} /></dd></div>
              {data.last_attempt_at && <div><dt className="text-text-secondary">Most recent attempt</dt><dd className="mt-1 text-text-primary">{dateLabel(data.last_attempt_at)}</dd></div>}
              {data.refresh_requested_at && <div><dt className="text-text-secondary">Refresh requested</dt><dd className="mt-1 text-text-primary">{dateLabel(data.refresh_requested_at)}</dd></div>}
              {state && <div><dt className="text-text-secondary">Stored score state</dt><dd className="mt-1"><StatusBadge variant={state.variant}>{state.label}</StatusBadge></dd></div>}
              {data.last_error_code && <div><dt className="text-text-secondary">Latest refresh error</dt><dd className="mt-1 break-words text-text-primary">{data.last_error_code}</dd></div>}
            </dl>
            {data.refresh_status === "FAILED" && data.computed_at && (
              <p className="mt-3 text-xs text-text-secondary">The latest refresh failed. The last successfully computed score remains available above.</p>
            )}
          </ScoreDetailSection>
        </>
      )}
    </div>
  );
}

/** Preserve independent business-specific queries while progressively disclosing diagnostics. */
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
    <Modal isOpen onClose={onClose} title={`Discovery Score · ${business.business_name}`} description="Stored scores and current visibility diagnostics · PHT" maxWidth="max-w-4xl" bodyClassName="themed-scrollbar" scrollable>
      <div className="space-y-4" key={business.id}>
        <DiscoveryScoreDetailContent query={detail} />
        <ScoreDetailSection
          title="Advanced Visibility Diagnostics"
          description="Recorded activity, normalization, and telemetry coverage."
          icon={ChartNoAxesColumn}
          attention={diagnostic.error ? "Diagnostics unavailable · Expand to retry" : undefined}
        >
          <VisibilityDiagnosticContent query={diagnostic} />
        </ScoreDetailSection>
        <aside className="flex gap-3 rounded-lg border border-info/30 bg-info/5 p-4 text-xs leading-5 text-text-secondary">
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-info" />
          <div>
            <h3 className="text-sm font-semibold text-text-primary">About these results</h3>
            <p className="mt-1">Visibility diagnostics reflect the current calculation context. Newer events, comparison-group membership, and configuration may differ from the stored result. They do not reconstruct a historical score.</p>
            <p className="mt-1">Telemetry coverage remains unverified: tracking completeness cannot currently be confirmed.</p>
          </div>
        </aside>
      </div>
    </Modal>
  );
}
