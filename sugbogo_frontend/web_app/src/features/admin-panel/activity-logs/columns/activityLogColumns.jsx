import { createColumnHelper } from "@tanstack/react-table";
import { Activity, Compass, Eye, LockKeyhole, ShieldCheck, Store } from "lucide-react";
import Button from "@/shared/components/Button";
import StatusBadge from "@/shared/components/StatusBadge";
import Tooltip from "@/shared/components/actions/Tooltip";
import {
  USER_ROLE_BADGE_VARIANT,
  USER_ROLE_OPTIONS,
} from "../../users/constants/userManagement";
import ActivityDate from "../components/ActivityDate";
import ActivityOutcome from "../components/ActivityOutcome";
import ActivityActorAvatar from "../components/ActivityActorAvatar";
import {
  activityActionLabel,
  activityActor,
  activityEntityLabel,
  activityLabel,
  activityTarget,
  activityTargetContext,
} from "../utils/activityLogPresentation";

const column = createColumnHelper();
const CATEGORY_ICONS = {
  administrative: ShieldCheck,
  merchant: Store,
  explorer: Compass,
  authentication: LockKeyhole,
};

/** Keep cells aligned with management tables and address selected occurrences by stable identity. */
export default function activityLogColumns(onView) {
  return [
    column.accessor("occurred_at", {
      header: "Date & Time",
      size: 160,
      meta: { skeleton: "text" },
      cell: ({ getValue }) => <ActivityDate value={getValue()} />,
    }),
    column.display({
      id: "actor",
      header: "Actor",
      size: 205,
      meta: { skeleton: "longText" },
      cell: ({ row }) => {
        const actor = row.original;
        const name = activityActor(actor);
        const usesCurrentName = !actor.actor_display_snapshot && Boolean(actor.current_actor?.name);
        const nameDescription = `${name} — current account name. No historical name was recorded.`;
        const nameElement = (
          <p
            className="truncate rounded text-sm font-medium text-text-primary focus-visible:outline-2 focus-visible:outline-info"
            title={usesCurrentName ? undefined : name}
            tabIndex={usesCurrentName ? 0 : undefined}
            aria-label={usesCurrentName ? nameDescription : undefined}
          >
            {name}
          </p>
        );
        return (
          <div className="flex min-w-0 items-center gap-2.5">
            <ActivityActorAvatar actor={actor.current_actor} />
            <div className="min-w-0">
              {usesCurrentName ? (
                <Tooltip content={nameDescription} place="top" asChild>
                  {nameElement}
                </Tooltip>
              ) : nameElement}
              {actor.actor_id != null && (actor.actor_display_snapshot || actor.current_actor?.name) && (
                <p className="mt-0.5 truncate text-xs tabular-nums text-text-secondary" title={`User #${actor.actor_id}`}>
                  #{actor.actor_id}
                </p>
              )}
            </div>
          </div>
        );
      },
    }),
    column.accessor("actor_role_snapshot", {
      header: "Role",
      size: 128,
      meta: { skeleton: "text" },
      cell: ({ getValue, row }) => {
        const historicalRole = getValue();
        const role = historicalRole || row.original.current_actor?.role;
        if (!role) {
          return <span aria-label="Role not recorded" className="text-sm text-text-secondary">—</span>;
        }
        const label = USER_ROLE_OPTIONS.find((option) => option.value === role)?.label;
        const roleLabel = label ?? activityLabel(role);
        const badge = (
          <StatusBadge variant={USER_ROLE_BADGE_VARIANT[role] ?? "neutral"} showDot={false}>
            {roleLabel}
          </StatusBadge>
        );
        if (historicalRole) {
          return <span className="inline-flex whitespace-nowrap">{badge}</span>;
        }
        const roleDescription = `${roleLabel} — current account role. No historical role was recorded.`;
        return (
          <Tooltip content={roleDescription} place="top" asChild>
            <span
              tabIndex={0}
              aria-label={roleDescription}
              className="inline-flex whitespace-nowrap rounded-full focus-visible:outline-2 focus-visible:outline-info"
            >
              {badge}
            </span>
          </Tooltip>
        );
      },
    }),
    column.accessor("module", {
      header: "Module",
      size: 190,
      meta: { skeleton: "text" },
      cell: ({ getValue }) => {
        const module = getValue();
        if (!module) {
          return <span aria-label="Module not recorded" className="text-sm text-text-secondary">—</span>;
        }
        return (
          <span className="inline-flex whitespace-nowrap" title={activityLabel(module)}>
            <StatusBadge showDot={false}>
              {module === "review_moderation" ? "Review moderation" : activityLabel(module)}
            </StatusBadge>
          </span>
        );
      },
    }),
    column.accessor("occurrence", {
      header: "Action",
      size: 250,
      meta: { skeleton: "longText" },
      cell: ({ row }) => {
        const Icon = CATEGORY_ICONS[row.original.category] ?? Activity;
        return (
          <div className="flex min-w-0 items-center gap-2">
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-text-secondary" />
            <span className="text-sm font-medium leading-5 text-text-primary">{activityActionLabel(row.original)}</span>
          </div>
        );
      },
    }),
    column.display({
      id: "target",
      header: "Target",
      size: 210,
      meta: { skeleton: "longText" },
      cell: ({ row }) => {
        const event = row.original;
        const context = activityTargetContext(event);
        return (
          <div className="min-w-0">
            <p className="line-clamp-2 break-words text-sm font-medium leading-5 text-text-primary">{activityTarget(event)}</p>
            {event.target_label && event.target_id != null && (
              <p className="mt-0.5 truncate text-xs text-text-secondary">
                {activityEntityLabel(event.target_type)} #{event.target_id}
              </p>
            )}
            {context && (
              <p className="mt-0.5 break-words text-xs text-text-secondary">{context}</p>
            )}
          </div>
        );
      },
    }),
    column.accessor("outcome", {
      header: "Outcome",
      size: 236,
      meta: { skeleton: "text" },
      cell: ({ getValue }) => <ActivityOutcome value={getValue()} emptyLabel="—" />,
    }),
    column.display({
      id: "actions",
      header: "Actions",
      size: 176,
      meta: { skeleton: "actions" },
      cell: ({ row }) => (
        <Button
          variant="secondary"
          size="sm"
          icon={Eye}
          className="h-8 cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-info [&>svg]:h-3.5 [&>svg]:w-3.5"
          aria-label={`View details for ${row.original.id}`}
          onClick={() => onView(row.original.id)}
        >
          View Details
        </Button>
      ),
    }),
  ];
}
