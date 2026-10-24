import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Clock3, Flag, MessageSquareText, ShieldAlert } from "lucide-react";

import PageHeader from "../components/PageHeader";
import TableTabs from "../components/data-table/TableTabs";
import useModerationTabCounts from "../moderation/hooks/useModerationTabCounts";
import ReviewDisputeWorkspace from "../review-disputes/components/ReviewDisputeWorkspace";
import UnderReviewWorkspace from "../under-review/components/UnderReviewWorkspace";
import SuspiciousActivityWorkspace from "../moderation/components/SuspiciousActivityWorkspace";
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
  const tabCounts = useModerationTabCounts();
  const tabs = MODERATION_TABS.map((tab) => ({
    ...tab,
    count: tabCounts[tab.id].count,
    countLoading: tabCounts[tab.id].isLoading,
  }));

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
        <div className="relative w-full rounded-2xl border border-stroke bg-background px-6 pb-6 pt-2">
          <nav
            aria-label="Moderation & Integrity sections"
            className="mb-6 overflow-x-auto pb-1"
          >
            <TableTabs
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          </nav>

          {activeTab === "under-review" ? (
            <UnderReviewWorkspace />
          ) : activeTab === "suspicious" ? (
            <SuspiciousActivityWorkspace />
          ) : activeTab === "reported" ? (
            <ReportedReviewWorkspace />
          ) : (
            <ReviewDisputeWorkspace />
          )}
        </div>
      </section>
    </>
  );
}
