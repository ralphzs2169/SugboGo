/** Distinguish persisted computation state from unverified exposure measurement. */
export default function DiscoveryScoreContext({ score }) {
  const observation = score.observation_context;
  const state = score.score_state?.toLowerCase() ?? "unknown";

  return (
    <div className="space-y-1 text-xs text-text-secondary">
      <p>
        Refresh state:{" "}
        <span className="capitalize text-text-primary">{state}</span>
      </p>
      <p>
        Computed: {score.computed_at ? "Yes" : "No"} · Provisional:{" "}
        {score.is_provisional ? "Yes" : "No"}
      </p>
      <p>Telemetry coverage: Unverified</p>
      {observation && (
        <>
          <p>
            Potential observation period:{" "}
            {observation.potential_observation_days} days of a{" "}
            {observation.window_days}-day window
          </p>
          {observation.short_history && (
            <p className="font-semibold">Short history</p>
          )}
        </>
      )}
    </div>
  );
}
