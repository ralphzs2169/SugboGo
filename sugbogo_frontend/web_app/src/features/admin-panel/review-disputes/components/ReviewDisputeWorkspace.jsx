import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { FileWarning } from "lucide-react";
import toast from "react-hot-toast";

import Button from "@/shared/components/Button";
import DataErrorState from "@/shared/components/errors/DataErrorState";
import useDebounce from "@/shared/hooks/useDebounce";
import ModerationQueueSkeleton from "../../moderation/components/ModerationQueueSkeleton";

import REVIEW_DISPUTE_DECISION_CONFIG, {
  MIN_MODERATION_NOTES_LENGTH,
} from "../config/reviewDisputeDecisionConfig";
import useReviewDisputeMutations from "../hooks/useReviewDisputeMutations";
import useReviewDisputes from "../hooks/useReviewDisputes";
import { fetchReviewDisputes } from "../services/reviewDisputeService";
import { nextDisputeSelection } from "../utils/disputeQueueSelection";
import DisputeDecisionModal from "./DisputeDecisionModal";
import DisputeInvestigation from "./DisputeInvestigation";
import DisputeQueueFilters from "./DisputeQueueFilters";
import DisputeQueueItem from "./DisputeQueueItem";

const PAGE_SIZE = 10;
const VALID_STATUSES = new Set(["pending", "upheld", "dismissed", "withdrawn", ""]);

export default function ReviewDisputeWorkspace() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = Number(searchParams.get("dispute_id")) || null;
  const requestedStatus = searchParams.get("status");
  const initialStatus = requestedStatus === "all"
    ? ""
    : VALID_STATUSES.has(requestedStatus) ? requestedStatus : "pending";
  const [filters, setFilters] = useState({
    search: "",
    status: initialStatus,
    reason: "",
    ordering: "-created_at",
  });
  const [page, setPage] = useState(1);
  const [decisionTarget, setDecisionTarget] = useState(null);
  const [notes, setNotes] = useState("");
  const [decisionError, setDecisionError] = useState("");
  const debouncedSearch = useDebounce(filters.search);
  const params = useMemo(() => ({
    page,
    page_size: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: filters.status || undefined,
    reason: filters.reason || undefined,
    ordering: filters.ordering,
  }), [page, debouncedSearch, filters.status, filters.reason, filters.ordering]);
  const { disputes, totalItems, pageCount, isLoading, isFetching, error, refetch } = useReviewDisputes(params);
  const { uphold, dismiss, isUpholding, isDismissing } = useReviewDisputeMutations();
  const decisionPending = isUpholding || isDismissing;

  function updateSearchParams(updates) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === "") {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      });
      return next;
    });
  }

  function selectDispute(disputeId) {
    updateSearchParams({ dispute_id: disputeId });
  }

  function changeFilter(key, value) {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPage(1);
    updateSearchParams({
      dispute_id: null,
      ...(key === "status" ? { status: value || "all" } : {}),
    });
  }

  function changePage(nextPage) {
    setPage(nextPage);
    selectDispute(null);
  }

  function openDecision(dispute, decision) {
    setNotes("");
    setDecisionError("");
    setDecisionTarget({ disputeId: dispute.id, decision });
  }

  function closeDecision() {
    if (!decisionPending) {
      setDecisionTarget(null);
      setNotes("");
      setDecisionError("");
    }
  }

  async function confirmDecision() {
    if (!decisionTarget || decisionPending || notes.trim().length < MIN_MODERATION_NOTES_LENGTH) {
      return;
    }

    const { disputeId, decision } = decisionTarget;
    const data = { admin_notes: notes.trim() };
    setDecisionError("");

    try {
      if (decision === "uphold") {
        await uphold({ disputeId, data });
      } else {
        await dismiss({ disputeId, data });
      }

      toast.success(REVIEW_DISPUTE_DECISION_CONFIG[decision].successMessage);
      setDecisionTarget(null);
      setNotes("");

      const currentList = queryClient.getQueryData([
        "admin",
        "review-disputes",
        params,
      ]);
      let refreshedItems = currentList?.items ?? [];

      if (!refreshedItems.length && page > 1) {
        const previousParams = { ...params, page: page - 1 };
        setPage(page - 1);
        try {
          const previousList = await fetchReviewDisputes(previousParams);
          queryClient.setQueryData(
            ["admin", "review-disputes", previousParams],
            previousList,
          );
          refreshedItems = previousList.items ?? [];
        } catch {
          selectDispute(null);
          return;
        }
      }

      selectDispute(
        nextDisputeSelection(disputes, refreshedItems, disputeId),
      );
    } catch (submissionError) {
      const response = submissionError.response?.data;
      const fieldError = response?.errors?.admin_notes;
      setDecisionError(
        (Array.isArray(fieldError) ? fieldError.join(" ") : fieldError)
        || response?.message
        || "Unable to resolve this dispute. Please try again.",
      );
    }
  }

  return (
    <div className="grid min-h-[620px] overflow-hidden rounded-xl border border-stroke bg-background lg:grid-cols-[minmax(320px,38%)_minmax(0,1fr)]">
      <aside aria-label="Review dispute queue" className="min-w-0 border-b border-stroke lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 pt-4">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Dispute Queue</h2>
            <p className="mt-0.5 text-xs text-text-secondary">
              {totalItems} {filters.status === "pending" ? "waiting for a decision" : "disputes"}
            </p>
          </div>
          {isFetching && !isLoading && (
            <span className="text-xs text-text-secondary">Refreshing…</span>
          )}
        </div>
        <DisputeQueueFilters filters={filters} onChange={changeFilter} />
        <div aria-busy={isLoading || isFetching} className="lg:max-h-[calc(100vh-360px)] lg:overflow-y-auto">
          {isLoading ? (
            <ModerationQueueSkeleton label="Loading review disputes" />
          ) : error ? (
            <DataErrorState
              title="Unable to load disputes"
              message="The dispute queue could not be loaded."
              onRetry={refetch}
            />
          ) : disputes.length ? (
            disputes.map((dispute) => (
              <DisputeQueueItem
                key={dispute.id}
                dispute={dispute}
                selected={selectedId === dispute.id}
                onSelect={() => selectDispute(dispute.id)}
              />
            ))
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
              <FileWarning className="h-8 w-8 text-text-secondary" />
              <h3 className="mt-3 text-sm font-semibold text-text-primary">
                {filters.search || filters.reason || filters.status !== "pending"
                  ? "No disputes match these filters"
                  : "No pending disputes"}
              </h3>
              <p className="mt-1 text-xs text-text-secondary">
                New merchant disputes will appear here when they need a decision.
              </p>
            </div>
          )}
        </div>
        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-stroke p-3 text-xs text-text-secondary">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => changePage(page - 1)}>Previous</Button>
            <span>Page {page} of {pageCount}</span>
            <Button size="sm" variant="secondary" disabled={page >= pageCount} onClick={() => changePage(page + 1)}>Next</Button>
          </div>
        )}
      </aside>
      <main aria-label="Dispute investigation" className="min-w-0">
        <DisputeInvestigation
          key={selectedId}
          disputeId={selectedId ? String(selectedId) : null}
          onDecision={openDecision}
          decisionPending={decisionPending}
        />
      </main>
      <DisputeDecisionModal
        decision={decisionTarget?.decision}
        disputeId={decisionTarget?.disputeId}
        notes={notes}
        error={decisionError}
        pending={decisionPending}
        onNotesChange={(value) => { setNotes(value); setDecisionError(""); }}
        onClose={closeDecision}
        onConfirm={confirmDecision}
      />
    </div>
  );
}
