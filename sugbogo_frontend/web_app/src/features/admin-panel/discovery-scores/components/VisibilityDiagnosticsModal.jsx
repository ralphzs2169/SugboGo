import { useQuery } from "@tanstack/react-query";

import Button from "@/shared/components/Button";
import Modal from "@/shared/components/modals/Modal";
import { formatDateTime } from "@/shared/utils/dateUtils";
import { visibilityDiagnosticOptions } from "../services/discoveryScoreService";

/** Render live calculation context with the existing operational feedback patterns. */
export function VisibilityDiagnosticContent({ query }) {
  const { data, isFetching, error, refetch } = query;
  if (isFetching) {
    return (
      <p role="status" aria-busy="true" className="text-sm text-text-secondary">
        Calculating current visibility diagnostics…
      </p>
    );
  }
  if (error) {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-text-secondary">
          {error.response?.data?.message ||
            "Unable to load visibility diagnostics."}
        </p>
        <Button variant="secondary" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  if (!data) {
    return (
      <p className="text-sm text-text-secondary">
        No diagnostic data returned.
      </p>
    );
  }

  const observation = data.observation_context;
  const signals = [
    [
      "Impressions",
      data.impression_count,
      data.maximum_impression_count,
      data.normalized_impressions,
      data.signal_weights.impressions,
    ],
    [
      "Profile visits",
      data.profile_visit_count,
      data.maximum_profile_visit_count,
      data.normalized_profile_visits,
      data.signal_weights.profile_visits,
    ],
    [
      "Distinct savers",
      data.unique_saver_count,
      data.maximum_unique_saver_count,
      data.normalized_saves,
      data.signal_weights.saves,
    ],
  ];

  return (
    <div className="space-y-5 text-sm">
      <section aria-label="Current calculation context" className="space-y-2">
        <h3 className="font-semibold text-text-primary">
          Current calculation context
        </h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-text-secondary">
          <dt>Business ID</dt>
          <dd>{data.business_id}</dd>
          <dt>Reference time</dt>
          <dd>{formatDateTime(data.reference_time)}</dd>
          <dt>Window start</dt>
          <dd>{formatDateTime(data.window_start)}</dd>
          <dt>Window end (exclusive)</dt>
          <dd>{formatDateTime(data.window_end)}</dd>
          <dt>Comparison group</dt>
          <dd>
            {data.comparison_group_level} · {data.comparison_group_size} active
            businesses
          </dd>
          <dt>Potential observation period</dt>
          <dd>
            {observation.potential_observation_days} days of a{" "}
            {observation.window_days}-day window
            {observation.short_history ? " · Short history" : ""}
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
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-text-secondary">
          Traction: <span className="font-mono">{data.traction}</span>
        </p>
        <p className="font-semibold text-text-primary">
          Current Visibility Gap:{" "}
          <span className="font-mono">{data.visibility_gap}</span>
        </p>
      </section>
      <section
        aria-label="Telemetry note"
        className="space-y-2 border-t border-stroke pt-4"
      >
        <h3 className="font-semibold text-text-primary">
          Telemetry coverage: Unverified
        </h3>
        <p className="text-text-secondary">{data.telemetry_note}</p>
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
