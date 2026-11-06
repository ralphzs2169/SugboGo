import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Clock3, Flag, List, MessageSquareText, ShieldAlert } from "lucide-react";

import PageHeader from "../components/PageHeader";
import TableTabs from "../components/data-table/TableTabs";
import useModerationTabCounts from "../moderation/hooks/useModerationTabCounts";
import ModerationMetrics from "../moderation/components/ModerationMetrics";
import { moderationMetricParams } from "../moderation/utils/moderationMetricNavigation";
import ReviewDisputeWorkspace from "../review-disputes/components/ReviewDisputeWorkspace";
import UnderReviewWorkspace from "../under-review/components/UnderReviewWorkspace";
import SuspiciousActivityWorkspace from "../moderation/components/SuspiciousActivityWorkspace";
import ReportedReviewWorkspace from "../reported-reviews/components/ReportedReviewWorkspace";
import useDocumentTitle from "@/shared/hooks/useDocumentTitle";

const MODERATION_TABS = [
  { id: "under-review", label: "Review Moderation", icon: Clock3 },
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
  const [workspaceReset, setWorkspaceReset] = useState(0);
  const queueScope = searchParams.get("queue_scope") === "aging" ? "aging" : "pending";
  const activeTabLabel = MODERATION_TABS.find((tab) => tab.id === activeTab).label;
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
      next.delete("queue_scope");

      return next;
    });
  }

  function selectMetricQueue(
    action,
    oldest,
  ) {
    setWorkspaceReset((previous) => previous + 1);
    setSearchParams((previous) => moderationMetricParams(previous, action, oldest));
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
        <div className="min-w-0">
          <nav
            aria-label="Moderation & Integrity sections"
            className="themed-scrollbar mb-6 overflow-x-auto pb-1"
          >
            <TableTabs
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          </nav>

          <ModerationMetrics
            tab={activeTab}
            tabLabel={activeTabLabel}
            onSelectQueue={selectMetricQueue}
          />

          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-text-primary">
            <List aria-hidden="true" className="h-4 w-4 shrink-0" />
            Moderation Workspace
          </h2>

          {queueScope === "aging" && (
            <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
              <span>Aging Cases: 48+ elapsed hours</span>
              <button
                type="button"
                onClick={() => selectMetricQueue("pending")}
                className="cursor-pointer rounded-md px-2 py-1 font-medium text-text-primary hover:bg-sidebar-active focus-visible:outline-2 focus-visible:outline-info"
              >
                Clear Aging Filter
              </button>
            </div>
          )}

          <div key={`${activeTab}:${queueScope}:${workspaceReset}`}>
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
        </div>
      </section>
    </>
  );
}
