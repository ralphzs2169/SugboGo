import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { formatCount } from "../../analytics/utils/presentation";

/** Render assigned account roles once each, exposing unknown roles and exact values beside the donut. */
export default function UserDistribution({ distribution }) {
  const roles = [
    { key: "explorer", label: "Explorers", color: "var(--color-primary)" },
    { key: "merchant", label: "Merchants", color: "var(--color-neutral)" },
    { key: "admin", label: "Admins", color: "var(--color-info)" },
    { key: "super_admin", label: "Super Admins", color: "var(--color-success)" },
    { key: "unknown_role", label: "Unknown role", color: "var(--color-text-secondary)" },
  ].map((role) => ({ ...role, count: distribution?.[role.key] }));
  const available = roles.every((role) => role.count != null);
  const total = distribution?.total;
  const visibleRoles = roles.filter((role) => role.key !== "unknown_role" || role.count > 0);

  return (
    <div>
      {/* The noninteractive plot has a complete visible text alternative */}
      <div className="relative mx-auto h-44 w-full min-w-0">
        {available && total > 0 && (
          <div aria-hidden="true" className="h-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart accessibilityLayer={false}>
                <Pie data={roles} dataKey="count" nameKey="label" innerRadius={60} outerRadius={82} startAngle={90} endAngle={-270} stroke="var(--color-background)" strokeWidth={2} isAnimationActive={false}>
                  {roles.map((role) => <Cell key={role.key} fill={role.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-text-secondary">Registered accounts</span>
          <span className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-text-primary">{formatCount(total)}</span>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
        {visibleRoles.map((role) => (
          <div key={role.key} className="flex min-w-0 items-start justify-between gap-2">
            <dt className="flex min-w-0 items-start gap-2 text-text-secondary">
              <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: role.color }} />
              {role.label}
            </dt>
            <dd className="font-semibold tabular-nums text-text-primary">{formatCount(role.count)}</dd>
          </div>
        ))}
      </dl>
      {total === 0 && <p className="mt-4 text-xs text-text-secondary">No registered accounts.</p>}
      <p className="mt-4 text-xs leading-relaxed text-text-secondary">All account statuses included. Each account is counted once by its current role.</p>
    </div>
  );
}
