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
          { label: "Management", href: "/admin-panel/transit-network" },
          { label: "Transit Network" },
        ]}
        title="Transit Network Management"
      />

      {/* Transit management workspace */}
      <section>
        {/* <p className="mb-5 max-w-3xl text-sm leading-relaxed text-text-secondary">
          Browse, author, and review jeepney routes, managed Transit Points, and
          directed transfer connections without leaving their shared geographic
          context.
        </p> */}
        <TransitNetworkWorkspace />
      </section>
    </>
  );
}
