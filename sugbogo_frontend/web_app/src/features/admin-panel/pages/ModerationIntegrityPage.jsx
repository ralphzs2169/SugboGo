import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Clock3, Flag, MessageSquareText, ShieldAlert } from "lucide-react";

import PageHeader from "../components/PageHeader";
import TableTabs from "../components/data-table/TableTabs";
import ReviewDisputeManagementTable from "../review-disputes/components/ReviewDisputeManagementTable";
import UnderReviewWorkspace from "../under-review/components/UnderReviewWorkspace";
import SuspiciousReviewWorkspace from "../suspicious-reviews/components/SuspiciousReviewWorkspace";
import ReportedReviewWorkspace from "../reported-reviews/components/ReportedReviewWorkspace";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";

const MODERATION_TABS = [
  { id: "under-review", label: "Under Review", icon: Clock3 },
  { id: "suspicious", label: "Suspicious", icon: ShieldAlert },
  { id: "reported", label: "Reported", icon: Flag },
  { id: "disputes", label: "Disputes", icon: MessageSquareText },
];

const VALID_TABS = new Set(MODERATION_TABS.map((tab) => tab.id));

export default function ModerationIntegrityPage() {
  useDocumentTitle("Moderation & Integrity | SugboGo Admin");

  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab = VALID_TABS.has(requestedTab)
    ? requestedTab
    : "under-review";

  useEffect(() => {
    if (requestedTab === activeTab) {
      return;
    }

    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);

        next.set("tab", activeTab);

        return next;
      },
      { replace: true },
    );
  }, [activeTab, requestedTab, setSearchParams]);

  function handleTabChange(tab) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);

      next.set("tab", tab);

      return next;
    });
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "SugboGo Admin", href: "/admin-panel/dashboard" },
          { label: "Trust & Safety" },
          { label: "Moderation & Integrity" },
        ]}
        title="Moderation & Integrity"
      />

      <section>
        {activeTab === "disputes" ? (
          <ReviewDisputeManagementTable
            tabs={MODERATION_TABS}
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />
        ) : (
          <div className="relative w-full rounded-2xl border border-stroke bg-background px-6 pb-6 pt-2">
            <nav
              aria-label="Moderation & Integrity sections"
              className="mb-6 overflow-x-auto pb-1"
            >
              <TableTabs
                tabs={MODERATION_TABS}
                activeTab={activeTab}
                onTabChange={handleTabChange}
              />
            </nav>

            {activeTab === "under-review" ? (
              <UnderReviewWorkspace />
            ) : activeTab === "suspicious" ? (
              <SuspiciousReviewWorkspace />
            ) : (
              <ReportedReviewWorkspace />
            )}
          </div>
        )}
      </section>
    </>
  );
}
