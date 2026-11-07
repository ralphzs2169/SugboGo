import {
  CONTEXT_LABELS,
  PROVENANCE_LABELS,
  STATE_LABELS,
} from "../constants/activityLogOptions";
import {
  activityDetailEntries,
  activityLabel,
} from "../utils/activityLogPresentation";
import ActivityDate from "./ActivityDate";
import ActivityOutcome from "./ActivityOutcome";
import ActivityActorAvatar from "./ActivityActorAvatar";

function DetailSection({ title, children }) {
  return (
    <section aria-label={title} className="rounded-lg border border-stroke bg-surface p-4">
      <h3 className="mb-3 text-base font-semibold text-text-primary">{title}</h3>
      {children}
    </section>
  );
}

function Fields({ entries }) {
  return (
    <dl className="space-y-3">
      {entries.map(([label, value]) => (
        <div key={label} className="grid gap-1 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-4">
          <dt className="text-xs font-medium text-text-secondary">{label}</dt>
          <dd className="min-w-0 whitespace-pre-wrap break-words text-sm text-text-primary">{value ?? "Not recorded"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Inspect only normalized snapshots and reviewed detail keys, without presenting raw JSON payloads. */
export default function ActivityLogDetail({ activity }) {
  const previous = activityDetailEntries(activity.previous_state, STATE_LABELS);
  const resulting = activityDetailEntries(activity.new_state, STATE_LABELS);
  const context = activityDetailEntries(activity.context, CONTEXT_LABELS);
  const provenance = activityDetailEntries(activity.provenance, PROVENANCE_LABELS);
  const currentActor = activity.current_actor;
  const actorEntries = [["Actor identifier", activity.actor_id]];
  if (
    activity.actor_display_snapshot &&
    activity.actor_display_snapshot === currentActor?.name
  ) {
    actorEntries.push(["Name (historical and current)", activity.actor_display_snapshot]);
  } else {
    actorEntries.push(["Historical name", activity.actor_display_snapshot]);
    if (currentActor) {
      actorEntries.push(["Current account name", currentActor.name || null]);
    }
  }
  if (
    activity.actor_role_snapshot &&
    activity.actor_role_snapshot === currentActor?.role
  ) {
    actorEntries.push(["Role (historical and current)", activityLabel(activity.actor_role_snapshot)]);
  } else {
    actorEntries.push(["Historical role", activityLabel(activity.actor_role_snapshot)]);
    if (currentActor) {
      actorEntries.push(["Current account role", activityLabel(currentActor.role)]);
    }
  }
  if (!currentActor && activity.actor_id != null) {
    actorEntries.push(["Current account", "Unavailable"]);
  }

  return (
    <div className="space-y-5">
      <DetailSection title="General Information">
        <Fields entries={[
          ["Action", activityLabel(activity.occurrence)],
          ["Activity category", activityLabel(activity.category)],
          ["Module", activityLabel(activity.module)],
          ["Date & time", <ActivityDate key="time" value={activity.occurred_at} />],
          ["Recorded outcome", <ActivityOutcome key="outcome" value={activity.outcome} />],
        ]} />
      </DetailSection>
      <DetailSection title="Actor Information">
        {(currentActor?.avatar_url || currentActor?.avatar_key) && (
          <div className="mb-4 flex items-center gap-3">
            <ActivityActorAvatar actor={currentActor} size="lg" />
            <p className="text-xs text-text-secondary">Current account avatar</p>
          </div>
        )}
        <Fields entries={actorEntries} />
      </DetailSection>
      <DetailSection title="Affected Record">
        <Fields entries={[
          ["Target type", activityLabel(activity.target_type)],
          ["Target identifier", activity.target_id],
          ["Target label", activity.target_label],
        ]} />
      </DetailSection>
      <DetailSection title="Change Information">
        <div className="space-y-5">
          {previous.length > 0 && (
            <div>
              <h4 className="mb-3 text-sm font-medium text-text-primary">Previous state</h4>
              <Fields entries={previous} />
            </div>
          )}
          {resulting.length > 0 && (
            <div>
              <h4 className="mb-3 text-sm font-medium text-text-primary">Resulting state</h4>
              <Fields entries={resulting} />
            </div>
          )}
          {typeof activity.reason === "string" && activity.reason.length > 0 && (
            <Fields entries={[["Administrative reason", activity.reason]]} />
          )}
          {context.length > 0 && <Fields entries={context} />}
          {!previous.length && !resulting.length && !activity.reason && !context.length && (
            <p className="text-sm text-text-secondary">
              No change details or decision reason are recorded for this activity.
            </p>
          )}
        </div>
      </DetailSection>
      <DetailSection title="Source Information">
        <Fields entries={[
          ["Event identity", activity.id],
          ["Source type", activityLabel(activity.source_type)],
          ["Source identifier", activity.source_id],
          ...provenance,
        ]} />
      </DetailSection>
    </div>
  );
}
