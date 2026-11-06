import { createColumnHelper } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import Button from "@/shared/components/Button";
import StatusBadge from "@/shared/components/StatusBadge";
import ActivityDate from "../components/ActivityDate";
import ActivityOutcome from "../components/ActivityOutcome";
import { activityActor, activityLabel, activityTarget } from "../utils/activityLogPresentation";

const column = createColumnHelper();

/** Keep cells aligned with management tables and address selected occurrences by stable identity. */
export default function activityLogColumns(onView) {
  return [
    column.accessor("occurred_at", {
      header: "Date & Time",
      size: 170,
      meta: { skeleton: "text" },
      cell: ({ getValue }) => <ActivityDate value={getValue()} />,
    }),
    column.display({
      id: "actor",
      header: "Actor",
      size: 210,
      meta: { skeleton: "longText" },
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="break-words text-sm font-medium text-text-primary">{activityActor(row.original)}</p>
          {row.original.actor_display_snapshot && row.original.actor_id != null && (
            <p className="mt-1 text-xs text-text-secondary">User #{row.original.actor_id}</p>
          )}
        </div>
      ),
    }),
    column.accessor("actor_role_snapshot", {
      header: "Role",
      size: 135,
      meta: { skeleton: "text" },
      cell: ({ getValue }) => getValue()
        ? <StatusBadge showDot={false}>{activityLabel(getValue())}</StatusBadge>
        : <span className="text-sm text-text-secondary">Not recorded</span>,
    }),
    column.accessor("module", {
      header: "Module",
      size: 190,
      meta: { skeleton: "text" },
      cell: ({ getValue }) => <span className="text-sm text-text-primary">{activityLabel(getValue())}</span>,
    }),
    column.accessor("occurrence", {
      header: "Action",
      size: 245,
      meta: { skeleton: "longText" },
      cell: ({ getValue }) => <span className="text-sm font-medium text-text-primary">{activityLabel(getValue())}</span>,
    }),
    column.display({
      id: "target",
      header: "Target",
      size: 230,
      meta: { skeleton: "longText" },
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="break-words text-sm text-text-primary">{activityTarget(row.original)}</p>
          {row.original.target_label && row.original.target_id != null && (
            <p className="mt-1 text-xs text-text-secondary">
              {activityLabel(row.original.target_type)} #{row.original.target_id}
            </p>
          )}
        </div>
      ),
    }),
    column.accessor("outcome", {
      header: "Outcome",
      size: 195,
      meta: { skeleton: "text" },
      cell: ({ getValue }) => <ActivityOutcome value={getValue()} />,
    }),
    column.display({
      id: "actions",
      header: "Actions",
      size: 140,
      meta: { skeleton: "actions" },
      cell: ({ row }) => (
        <Button
          variant="action"
          size="sm"
          icon={Eye}
          aria-label={`View details for ${row.original.id}`}
          onClick={() => onView(row.original.id)}
        >
          View Details
        </Button>
      ),
    }),
  ];
}
