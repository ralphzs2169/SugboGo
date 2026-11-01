import DashboardDonut from "./DashboardDonut";

/** Expose exact assigned-role inventory with interactive proportions, retaining unknown roles and all account statuses. */
export default function UserDistribution({ distribution }) {
  const roles = [
    { key: "explorer", label: "Explorers", color: "var(--color-primary)" },
    { key: "merchant", label: "Merchants", color: "var(--color-neutral)" },
    { key: "admin", label: "Admins", color: "var(--color-info)" },
    {
      key: "super_admin",
      label: "Super Admins",
      color: "var(--color-success)",
    },
    {
      key: "unknown_role",
      label: "Unknown role",
      color: "var(--color-text-secondary)",
      optional: true,
    },
  ].map((role) => ({ ...role, count: distribution?.[role.key] }));

  return (
    <div>
      {/* The chart and focusable legend share the same exact inventory proportions. */}
      <DashboardDonut
        rows={roles}
        total={distribution?.total}
        source={distribution}
        label="Registered accounts by role"
        unit="accounts"
        denominator="registered accounts"
        centerLabel="Registered accounts"
        emptyMessage="No registered accounts."
      />
      <p className="mt-4 text-xs leading-relaxed text-text-secondary">
        All account statuses included. Each account is counted once by its
        current role.
      </p>
    </div>
  );
}
