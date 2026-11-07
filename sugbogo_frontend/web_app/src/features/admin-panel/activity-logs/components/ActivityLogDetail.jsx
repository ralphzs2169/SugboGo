import { Activity, Clock3, GitCompareArrows, Target, UserRound } from "lucide-react";
import StatusBadge from "@/shared/components/StatusBadge";
import Tooltip from "@/shared/components/actions/Tooltip";
import { USER_ROLE_BADGE_VARIANT, USER_ROLE_OPTIONS } from "../../users/constants/userManagement";
import {
  CONTEXT_LABELS,
  STATE_LABELS,
} from "../constants/activityLogOptions";
import {
  activityActionLabel,
  activityActor,
  activityDetailEntries,
  activityEntityLabel,
  activityLabel,
  activityTarget,
} from "../utils/activityLogPresentation";
import ActivityDate from "./ActivityDate";
import ActivityOutcome from "./ActivityOutcome";
import ActivityActorAvatar from "./ActivityActorAvatar";

function DetailSection({ title, icon: Icon, children }) {
  return (
    <section aria-label={title} className="min-w-0 border-t border-stroke pt-5">
      <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-text-primary">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-text-secondary" />
        {title}
      </h3>
      {children}
    </section>
  );
}

function Fields({ entries }) {
  return (
    <dl className="divide-y divide-stroke">
      {entries.map(([label, value]) => (
        <div key={label} className="grid min-w-0 gap-1 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-3">
          <dt className="text-xs font-medium leading-5 text-text-secondary">{label}</dt>
          <dd className="min-w-0 whitespace-pre-wrap text-sm leading-5 text-text-primary [overflow-wrap:anywhere]">{value ?? "Not recorded"}</dd>
        </div>
      ))}
    </dl>
  );
}

function actorRoleLabel(role) {
  return USER_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? activityLabel(role);
}

/** Inspect meaningful activity facts while keeping historical identity and safe record references explicit. */
export default function ActivityLogDetail({ activity }) {
  const previous = activityDetailEntries(activity.previous_state, STATE_LABELS);
  const resulting = activityDetailEntries(activity.new_state, STATE_LABELS);
  const context = activityDetailEntries(activity.context, CONTEXT_LABELS);
  const currentActor = activity.current_actor;
  const historicalName = activity.actor_display_snapshot;
  const historicalRole = activity.actor_role_snapshot;
  const sameName = Boolean(historicalName && historicalName === currentActor?.name);
  const sameRole = Boolean(historicalRole && historicalRole === currentActor?.role);
  const role = historicalRole || currentActor?.role;
  let nameScope = "Current account name";
  if (sameName) {
    nameScope = "Name (historical and current)";
  } else if (historicalName) {
    nameScope = "Historical name";
  }
  let roleScope = "Current account role";
  if (sameRole) {
    roleScope = "Role (historical and current)";
  } else if (historicalRole) {
    roleScope = "Historical role";
  }
  const hasName = Boolean(historicalName || currentActor?.name);
  const actorEntries = [];
  if (historicalName && currentActor?.name && !sameName) {
    actorEntries.push(["Current account name", currentActor.name]);
  }
  if (historicalRole && currentActor?.role && !sameRole) {
    actorEntries.push(["Current account role", actorRoleLabel(currentActor.role)]);
  }
  if (!currentActor && activity.actor_id != null) {
    actorEntries.push(["Current account", "Unavailable"]);
  }
  const name = activityActor(activity);
  const currentNameHint = `${name} is the current account name. A historical name was not recorded.`;
  const currentRoleHint = `${actorRoleLabel(role)} is the current account role. A historical role was not recorded.`;
  const hasTarget = Boolean(activity.target_label || (activity.target_type && activity.target_id != null));
  const recordReferences = activityDetailEntries(activity.provenance, {
    business_id: "Business ID",
    specialty_tag_id: "Specialty tag ID",
    submission_number: "Submission number",
  }).filter(([label, value]) => !(
    label === "Business ID" && activity.target_type === "business" && value === String(activity.target_id)
  )).map(([label, identifier]) => {
    const key = label === "Business ID" ? "business" : label === "Specialty tag ID" ? "specialty_tag" : null;
    const current = activity.source_type === "business_vouch" && key
      ? activity.current_related_records?.[key]
      : null;
    if (!current?.name || String(current.id) !== identifier) return [label, identifier];
    return [label === "Business ID" ? "Business" : "Specialty tag", (
      <span key={key}>
        {current.name}
        <span className="mt-0.5 block text-xs text-text-secondary">#{identifier} · Current name</span>
      </span>
    )];
  });
  const hasReason = typeof activity.reason === "string" && activity.reason.length > 0;
  const hasChanges = previous.length > 0 || resulting.length > 0 || hasReason || context.length > 0;

  return (
    <div className="space-y-5">
      <section aria-label="General Information" className="rounded-xl border border-stroke bg-background p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="mb-2 flex items-center gap-2 text-xs font-medium text-text-secondary">
              <Activity aria-hidden="true" className="h-4 w-4" />
              Recorded activity
            </p>
            <h3 className="text-xl font-semibold leading-snug text-text-primary [overflow-wrap:anywhere]">
              {activityActionLabel(activity)}
            </h3>
          </div>
          {activity.outcome && <ActivityOutcome value={activity.outcome} />}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
          <span className="sr-only">Activity category</span>
          <StatusBadge showDot={false}>{activity.category ? activityLabel(activity.category) : "Category unavailable"}</StatusBadge>
          <span aria-hidden="true">·</span>
          <span>{activity.module ? activityLabel(activity.module) : "Module unavailable"}</span>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stroke pt-4">
          <div className="flex items-center gap-2.5">
            <Clock3 aria-hidden="true" className="h-4 w-4 shrink-0 text-text-secondary" />
            <ActivityDate value={activity.occurred_at} />
          </div>
        </div>
      </section>

      <div className="space-y-5">
        <DetailSection title="Actor Information" icon={UserRound}>
          <div className="flex min-w-0 items-center gap-3">
            <ActivityActorAvatar actor={currentActor} size="lg" />
            <div className="min-w-0">
              {historicalName && <p className="mb-0.5 text-xs text-text-secondary">{nameScope}</p>}
              {!historicalName && currentActor?.name ? (
                <Tooltip content={currentNameHint} place="top" asChild>
                  <p tabIndex={0} aria-label={currentNameHint} className="rounded text-base font-semibold leading-6 text-text-primary focus-visible:outline-2 focus-visible:outline-info [overflow-wrap:anywhere]">{name}</p>
                </Tooltip>
              ) : <p className="text-base font-semibold leading-6 text-text-primary [overflow-wrap:anywhere]">{name}</p>}
              {hasName && activity.actor_id != null && (
                <p className="mt-0.5 text-xs tabular-nums text-text-secondary">User #{activity.actor_id}</p>
              )}
            </div>
          </div>
          {role && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {historicalRole && <span className="text-xs text-text-secondary">{roleScope}</span>}
              {!historicalRole ? (
                <Tooltip content={currentRoleHint} place="top" asChild>
                  <span tabIndex={0} aria-label={currentRoleHint} className="inline-flex rounded-full focus-visible:outline-2 focus-visible:outline-info">
                    <StatusBadge variant={USER_ROLE_BADGE_VARIANT[role] ?? "neutral"} showDot={false}>{actorRoleLabel(role)}</StatusBadge>
                  </span>
                </Tooltip>
              ) : <StatusBadge variant={USER_ROLE_BADGE_VARIANT[role] ?? "neutral"} showDot={false}>{actorRoleLabel(role)}</StatusBadge>}
            </div>
          )}
          {actorEntries.length > 0 && <div className="mt-4 border-t border-stroke pt-4"><Fields entries={actorEntries} /></div>}
        </DetailSection>

        <DetailSection title="Affected Record" icon={Target}>
          {hasTarget ? (
            <>
              <p className="text-base font-semibold leading-6 text-text-primary [overflow-wrap:anywhere]">{activityTarget(activity)}</p>
              {activity.target_label && activity.target_id != null && (
                <p className="mt-1 text-xs text-text-secondary [overflow-wrap:anywhere]">
                  {activityEntityLabel(activity.target_type)} #{activity.target_id}
                </p>
              )}
            </>
          ) : <p className="text-sm leading-6 text-text-secondary">Target identity was not recorded for this activity.</p>}
          {recordReferences.length > 0 && <div className="mt-4 border-t border-stroke pt-4"><Fields entries={recordReferences} /></div>}
        </DetailSection>
      </div>

      {hasChanges ? (
        <DetailSection title="Change Information" icon={GitCompareArrows}>
          <div className="space-y-4">
            {(previous.length > 0 || resulting.length > 0) && (
              <div className={`grid gap-3 ${previous.length > 0 && resulting.length > 0 ? "sm:grid-cols-2" : ""}`}>
                {[
                  ["Previous state", previous],
                  ["Resulting state", resulting],
                ].filter(([, entries]) => entries.length > 0).map(([title, entries]) => (
                  <div key={title} className="min-w-0 rounded-lg border border-stroke bg-surface-muted p-3">
                    <h4 className="mb-3 text-xs font-semibold text-text-secondary">{title}</h4>
                    <Fields entries={entries} />
                  </div>
                ))}
              </div>
            )}
            {hasReason && (
              <div className="rounded-lg border-l-2 border-primary bg-surface-muted p-4">
                <h4 className="mb-1 text-xs font-medium text-text-secondary">Administrative reason</h4>
                <p className="whitespace-pre-wrap text-sm leading-6 text-text-primary [overflow-wrap:anywhere]">{activity.reason}</p>
              </div>
            )}
            {context.length > 0 && <Fields entries={context} />}
          </div>
        </DetailSection>
      ) : null}

    </div>
  );
}
