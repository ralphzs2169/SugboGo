import { useQuery } from "@tanstack/react-query";

import Button from "@/shared/components/Button";
import Modal from "@/shared/components/modals/Modal";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import { formatTimestamp } from "../../analytics/utils/presentation";
import { formatScore, telemetryPresentation } from "../utils/presentation";
import { visibilityDiagnosticOptions } from "../services/discoveryScoreService";

/** Render live calculation context with the existing operational feedback patterns. */
export function VisibilityDiagnosticContent({ query }) {
  const { data, isFetching, error, refetch } = query;
  if (isFetching && !data && !error) {
    return (
      <p role="status" aria-busy="true" className="text-sm text-text-secondary">
        Calculating current visibility diagnostics…
      </p>
    );
  }
  if (error && !data) {
    return (
      <DataErrorState compact framed title="Unable to load visibility diagnostics"
        message={error.response?.data?.message || "Visibility diagnostics are currently unavailable."}
        onRetry={() => refetch()} retrying={isFetching} retryLabel="Retry visibility diagnostics" />
    );
  }
  if (!data) {
    return (
      <div className="space-y-3 text-sm text-text-secondary">
        <p>No diagnostic data returned.</p>
        <Button variant="secondary" onClick={() => refetch()}>Retry visibility diagnostics</Button>
      </div>
    );
  }

  const observation = data.observation_context;
  const coverage = data.telemetry_coverage ?? {
    value: null,
    reason: data.telemetry_reason ?? (
      data.coverage_verified === false ? "coverage_unverified" : null
    ),
  };
  const telemetry = telemetryPresentation(coverage);
  const signals = [
    [
      "Impressions",
      data.impression_count,
      data.maximum_impression_count,
      data.normalized_impressions,
      data.signal_weights?.impressions,
    ],
    [
      "Profile visits",
      data.profile_visit_count,
      data.maximum_profile_visit_count,
      data.normalized_profile_visits,
      data.signal_weights?.profile_visits,
    ],
    [
      "Distinct savers",
      data.unique_saver_count,
      data.maximum_unique_saver_count,
      data.normalized_saves,
      data.signal_weights?.saves,
    ],
  ];

  return (
    <div className="space-y-5 text-sm" aria-busy={isFetching}>
      {error && <DataErrorState compact retainedData title="Unable to refresh visibility diagnostics"
        onRetry={() => refetch()} retrying={isFetching} retryLabel="Retry visibility diagnostics" />}
      {isFetching && <p role="status" className="text-xs text-text-secondary">Refreshing visibility diagnostics…</p>}
      <section aria-label="Current calculation context" className="space-y-2">
        <h3 className="font-semibold text-text-primary">
          Current calculation context
        </h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-text-secondary">
          <dt>Business ID</dt>
          <dd>{data.business_id}</dd>
          <dt>Reference time</dt>
          <dd>{formatTimestamp(data.reference_time)} · PHT</dd>
          <dt>Window start</dt>
          <dd>{formatTimestamp(data.window_start)} · PHT</dd>
          <dt>Window end (exclusive)</dt>
          <dd>{formatTimestamp(data.window_end)} · PHT</dd>
          <dt>Comparison group</dt>
          <dd>
            {data.comparison_group_level} · {data.comparison_group_size} active
            businesses
          </dd>
          <dt>Potential observation period</dt>
          <dd>
            {observation ? <>{observation.potential_observation_days} days of a{" "}
              {observation.window_days}-day window
              {observation.short_history ? " · Short history" : ""}</> : "Unavailable"}
          </dd>
        </dl>
        <p className="text-xs text-text-secondary">
          Age since business creation is a proxy, not verified tracking
          duration.
        </p>
      </section>
      <section
        aria-label="Recorded activity and normalization"
        className="space-y-2"
      >
        <h3 className="font-semibold text-text-primary">
          Recorded activity and normalization
        </h3>
        <div className="overflow-x-auto rounded-lg border border-stroke">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface text-text-secondary">
              <tr>
                {[
                  "Signal",
                  "Recorded",
                  "Group maximum",
                  "Normalized",
                  "Weight",
                ].map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className="px-3 py-2 font-semibold"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-text-primary">
              {signals.map(([label, ...values]) => (
                <tr key={label} className="border-t border-stroke">
                  <th scope="row" className="px-3 py-2 font-medium">
                    {label}
                  </th>
                  {values.map((value, index) => (
                    <td
                      key={index}
                      className="px-3 py-2 font-mono tabular-nums"
                    >
                      {index < 2 ? (value ?? "—") : formatScore(value)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-text-secondary">
          Traction: <span className="tabular-nums">{formatScore(data.traction)}</span>
        </p>
        <p className="font-semibold text-text-primary">
          Current Visibility Gap:{" "}
          <span className="tabular-nums">{formatScore(data.visibility_gap)}</span>
        </p>
      </section>
      <section
        aria-label="Telemetry note"
        className="space-y-2 border-t border-stroke pt-4"
      >
        <h3 className="font-semibold text-text-primary">
          Telemetry coverage: {telemetry.value}
        </h3>
        <p className="text-text-secondary">{data.telemetry_note}</p>
        <p className="text-xs text-text-secondary">Distinct savers are unique accounts with recorded SAVE events in the observation window. They may no longer hold the business in a Pocket.</p>
      </section>
    </div>
  );
}

/** Fetch one current diagnostic while this explicitly requested modal is mounted. */
export default function VisibilityDiagnosticsModal({ business, onClose }) {
  const query = useQuery(visibilityDiagnosticOptions(business.id));

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Visibility diagnostics · ${business.business_name}`}
      description="Current diagnostic calculation. Newer events, group membership, or configuration may differ from the persisted score. This does not reproduce a historical score or update ranking."
      maxWidth="max-w-2xl"
      scrollable
    >
      <VisibilityDiagnosticContent query={query} />
    </Modal>
  );
}
