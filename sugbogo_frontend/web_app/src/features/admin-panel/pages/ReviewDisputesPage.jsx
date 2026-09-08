import useDocumentTitle from "@/shared/hooks/useDocumentTitle";

import PageHeader from "../components/PageHeader";
import ReviewDisputeManagementTable from "../review-disputes/components/ReviewDisputeManagementTable";

export default function ReviewDisputesPage() {
  useDocumentTitle("Review Disputes | SugboGo Admin");

  return (
    <>
      {/* Page header */}
      <PageHeader
        breadcrumbs={[
          {
            label: "SugboGo Admin",
            href: "/admin-panel",
          },
          {
            label: "Moderation",
          },
          {
            label: "Review Disputes",
          },
        ]}
        title="Review Disputes"
      />

      {/* Dispute management */}
      <section>
        <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-text-secondary">
          Review Disputes
        </h2>

        <ReviewDisputeManagementTable />
      </section>
    </>
  );
}
