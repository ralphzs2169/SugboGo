import PageHeader from "@/features/admin-panel/components/PageHeader";
import TransitNetworkManagementTable from "@/features/admin-panel/transit-network/components/TransitNetworkManagementTable";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";

/**
 * Hosts the admin transit network management shell and its resource tables.
 */
export default function TransitNetworkPage() {
  useDocumentTitle("Transit Network | SugboGo Admin");

  return (
    <>
      {/* Page header */}
      <PageHeader
        breadcrumbs={[
          { label: "SugboGo Admin", href: "/admin-panel/dashboard" },
          { label: "Management", href: "/admin-panel/transit-network" },
          { label: "Transit Network" },
        ]}
        title="Transit Network Management"
      />

      {/* Transit management workspace */}
      <section>
        <p className="mb-5 max-w-3xl text-sm leading-relaxed text-text-secondary">
          Manage jeepney route codes, transit infrastructure points, and reviewed
          transfer connections. Geographic route path editing will be available in
          the dedicated map editor.
        </p>
        <TransitNetworkManagementTable />
      </section>
    </>
  );
}
