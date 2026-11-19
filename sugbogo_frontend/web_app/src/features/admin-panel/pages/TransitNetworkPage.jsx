import PageHeader from "@/features/admin-panel/components/PageHeader";
import TransitNetworkWorkspace from "@/features/admin-panel/transit-network/components/workspace/TransitNetworkWorkspace";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";

/**
 * Hosts the persistent map-centered admin transit network workspace.
 */
export default function TransitNetworkPage() {
  useDocumentTitle("Transit Network | SugboGo Admin");

  return (
    <>
      {/* Page header */}
      <PageHeader
        breadcrumbs={[
          { label: "SugboGo Admin", href: "/admin-panel/dashboard" },
          { label: "Discovery" },
          { label: "Transit Network" },
        ]}
        title="Transit Network Management"
      />

      {/* Transit management workspace */}
      <section>
        <TransitNetworkWorkspace />
      </section>
    </>
  );
}
