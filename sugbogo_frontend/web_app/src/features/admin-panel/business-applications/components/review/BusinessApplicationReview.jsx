import ApplicationReviewHeader from "./ApplicationReviewHeader";
import BusinessDocumentsReview from "./BusinessDocumentsReview";
import BusinessHoursReview from "./BusinessHoursReview";
import BusinessIdentityReview from "./BusinessIdentityReview";
import BusinessLocationReview from "./BusinessLocationReview";
import BusinessPhotosReview from "./BusinessPhotosReview";

import ApplicationReviewContextBar from "./ReviewContextBar";
import RejectApplicationDrawer from "./RejectApplicationDrawer";
import ApproveApplicationConfirmationModal from "./ApproveApplicationConfirmationModal";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { fetchBusinessApplicationDocumentPreview } from "../../services/businessApplicationService";

import Button from "@/shared/components/Button";
import useApproveBusinessApplication from "../../hooks/useApproveBusinessApplication";
import useApplicationDuplicates from "../../hooks/useApplicationDuplicates";
import PossibleDuplicatesReview from "./PossibleDuplicatesReview";
import { getDuplicateReviewStatus } from "../../utils/applicationDecision.utils";

/**
 * Composes the submitted merchant application into the complete
 * administrative review workspace.
 *
 * Keeps page-level data loading separate from the individual
 * application review sections.
 */
export default function BusinessApplicationReview({
  application,
  onApplicationRejected,
  onApplicationApproved,
}) {
  const reviewHeaderRef = useRef(null);
  const reviewContentRef = useRef(null);
  const decisionFooterRef = useRef(null);
  const duplicateReviewRef = useRef(null);
  const duplicates = useApplicationDuplicates(application.id);
  const duplicateSummary = getDuplicateReviewStatus(
    duplicates.query,
    application.latest_submission_id,
  );
  const duplicateApprovalBlocked =
    !["empty", "matches"].includes(duplicateSummary.state) ||
    !duplicates.query.data ||
    duplicates.query.isFetching ||
    duplicates.query.isError ||
    duplicates.mutation.isPending ||
    duplicates.query.data.approval_blocked ||
    duplicates.query.data.submission_id !== application.latest_submission_id;
  const duplicateBlockReason = duplicates.mutation.isPending
    ? "Saving assessment�"
    : duplicateSummary.state === "matches"
      ? duplicates.query.data.approval_blocked
        ? `Approval blocked: ${duplicateSummary.message}`
        : null
      : duplicateSummary.state === "empty"
        ? null
        : duplicateSummary.message;
  const [approvalSubmissionId, setApprovalSubmissionId] = useState(null);
  const [showContextBar, setShowContextBar] = useState(false);

  const [documentPreviewUrls, setDocumentPreviewUrls] = useState({});

  const [rejectionSubmissionId, setRejectionSubmissionId] = useState(null);
  const [rejectionSession, setRejectionSession] = useState(0);
  const [isRejectDrawerOpen, setIsRejectDrawerOpen] = useState(false);
  const [isApproveConfirmationOpen, setIsApproveConfirmationOpen] =
    useState(false);

  const { approveApplication, isSubmitting: isApproving } =
    useApproveBusinessApplication();

  const businessName =
    application.identity?.business_name || "Unnamed Business";

  const isResolved = ["approved", "rejected"].includes(application.status);
  const isResubmission = application.status === "submitted";

  // Reserve the actual fixed-footer height, including wrapped messages and stacked actions.
  useLayoutEffect(() => {
    const footer = decisionFooterRef.current;
    const content = reviewContentRef.current;
    if (isResolved || !footer || !content) return;
    function measureFooter() {
      content.style.setProperty(
        "--review-footer-height",
        `${footer.getBoundingClientRect().height}px`,
      );
    }
    measureFooter();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measureFooter)
        : null;
    observer?.observe(footer);
    window.addEventListener("resize", measureFooter);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measureFooter);
    };
  }, [isResolved]);

  function scrollToDuplicateReview(event) {
    event.preventDefault();
    const section = duplicateReviewRef.current;
    if (!section) return;
    section.focus({ preventScroll: true });
    section.scrollIntoView({
      block: "start",
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }

  // Show the compact context bar when the header is scrolled out of view
  useEffect(() => {
    const header = reviewHeaderRef.current;

    if (!header) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowContextBar(!entry.isIntersecting);
      },
      {
        threshold: 0,
      },
    );

    observer.observe(header);

    return () => observer.disconnect();
  }, []);

  // Load document previews for all submitted verification documents
  useEffect(() => {
    let cancelled = false;
    const objectUrls = [];
    async function loadDocumentPreviews() {
      if (!application.documents?.length) {
        setDocumentPreviewUrls({});
        return;
      }

      const results = await Promise.allSettled(
        application.documents.map(async (document) => {
          const blob = await fetchBusinessApplicationDocumentPreview(
            application.id,
            document.id,
          );

          const pdfBlob = new Blob([blob], { type: "application/pdf" });
          const objectUrl = URL.createObjectURL(pdfBlob);
          objectUrls.push(objectUrl); // also fixes the earlier cleanup-leak bug

          return [document.id, objectUrl];
        }),
      );

      if (cancelled) return;

      const entries = results
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value);

      setDocumentPreviewUrls(Object.fromEntries(entries));
    }

    loadDocumentPreviews();

    return () => {
      cancelled = true;

      objectUrls.forEach((objectUrl) => {
        URL.revokeObjectURL(objectUrl);
      });
    };
  }, [application.id, application.documents]);

  function getSectionFeedback(section) {
    return application.previous_review?.feedback?.find(
      (item) => item.section === section,
    );
  }

  function hasSectionChanged(section) {
    return (
      application.previous_review?.changed_sections?.includes(section) ?? false
    );
  }

  // Handle approval confirmation
  async function handleConfirmApproval() {
    try {
      await approveApplication(application.id, approvalSubmissionId);

      toast.success("Application approved successfully.");

      setIsApproveConfirmationOpen(false);

      onApplicationApproved?.();
    } catch (error) {
      void duplicates.query.refetch();
      console.error("Failed to approve application:", error);

      toast.error(
        error.response?.data?.message ||
          "The application could not be approved. Please try again.",
      );
    }
  }

  return (
    <div
      ref={reviewContentRef}
      className="space-y-6"
      style={{
        paddingBottom: isResolved
          ? undefined
          : "calc(var(--review-footer-height, 180px) + 16px)",
      }}
    >
      {/* Compact context bar */}
      {showContextBar && (
        <ApplicationReviewContextBar application={application} />
      )}

      {/* Application header */}
      <div ref={reviewHeaderRef}>
        <ApplicationReviewHeader application={application} />
      </div>

      {/* Business identity */}
      <BusinessIdentityReview
        identity={application.identity}
        feedback={getSectionFeedback("identity")}
        isChangedSinceLastReview={hasSectionChanged("identity")}
        isResubmission={isResubmission}
      />

      {/* Business location */}

      <BusinessLocationReview
        location={application.location}
        feedback={getSectionFeedback("location")}
        isChangedSinceLastReview={hasSectionChanged("location")}
        isResubmission={isResubmission}
      />

      {/* Operating hours */}
      <BusinessHoursReview
        operatingHours={application.operating_hours}
        feedback={getSectionFeedback("operating_hours")}
        isChangedSinceLastReview={hasSectionChanged("operating_hours")}
        isResubmission={isResubmission}
      />

      {/* Business photos */}
      <BusinessPhotosReview
        photos={application.photos}
        feedback={getSectionFeedback("photos")}
        isChangedSinceLastReview={hasSectionChanged("photos")}
        isResubmission={isResubmission}
      />

      {/* Verification documents */}
      <BusinessDocumentsReview
        documents={application.documents}
        documentPreviewUrls={documentPreviewUrls}
        feedback={getSectionFeedback("documents")}
        isChangedSinceLastReview={hasSectionChanged("documents")}
        isResubmission={isResubmission}
      />

      <div
        id="duplicate-review"
        ref={duplicateReviewRef}
        tabIndex={-1}
        aria-label="Duplicate review"
        className="scroll-mt-24 space-y-4 focus:outline-none"
      >
        <PossibleDuplicatesReview
          application={application}
          query={duplicates.query}
          mutation={duplicates.mutation}
        />
      </div>

      {!isResolved && (
        <>
          {/* Fixed decision area */}
          <section
            ref={decisionFooterRef}
            className="
            fixed bottom-0 right-0 z-30
            left-0
            border-t border-stroke
            bg-background/95
            px-6 py-4
            backdrop-blur
            sm:px-4
            lg:left-[var(--admin-sidebar-width)]
          "
          >
            <p
              role="status"
              className={`mb-3 text-sm ${duplicateApprovalBlocked ? "text-danger" : "text-success"}`}
            >
              {duplicateApprovalBlocked ? (
                <a
                  href="#duplicate-review"
                  onClick={scrollToDuplicateReview}
                  className="inline-flex min-h-8 cursor-pointer items-center gap-2 rounded-sm underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <AlertTriangle
                    size={17}
                    className="shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    {duplicateBlockReason || duplicateSummary.message}
                  </span>
                </a>
              ) : (
                duplicateSummary.message
              )}
            </p>
            <div className="flex items-center justify-between gap-4">
              <div className="hidden min-w-0 sm:block">
                <h2 className="text-sm font-semibold text-text-primary">
                  Review Decision
                </h2>

                <p className="mt-0.5 text-xs text-text-secondary">
                  Approve the application or request changes from the applicant.
                </p>
              </div>

              <div className="flex w-full flex-col-reverse gap-3 sm:w-auto sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => {
                    setRejectionSubmissionId(application.latest_submission_id);
                    setRejectionSession((session) => session + 1);
                    setIsRejectDrawerOpen(true);
                  }}
                >
                  Reject Application
                </Button>

                <Button
                  type="button"
                  variant="success"
                  disabled={duplicateApprovalBlocked}
                  onClick={() => {
                    setApprovalSubmissionId(application.latest_submission_id);
                    setIsApproveConfirmationOpen(true);
                  }}
                >
                  Approve Application
                </Button>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Rejection Drawer */}
      <RejectApplicationDrawer
        key={rejectionSession}
        isOpen={isRejectDrawerOpen}
        applicationId={application.id}
        onClose={() => setIsRejectDrawerOpen(false)}
        onSuccess={onApplicationRejected}
        businessName={businessName}
        expectedSubmissionId={rejectionSubmissionId}
        duplicateQuery={duplicates.query}
      />

      {/* Approval Confirmation */}
      <ApproveApplicationConfirmationModal
        isOpen={isApproveConfirmationOpen}
        applicationId={application.id}
        identity={application.identity}
        storefrontPhoto={application.photos?.[0]?.photo_url}
        onClose={() => setIsApproveConfirmationOpen(false)}
        onConfirm={handleConfirmApproval}
        loading={isApproving}
        blockedReason={
          duplicateBlockReason ||
          (approvalSubmissionId !== application.latest_submission_id
            ? "Submission changed. Refresh the application."
            : null)
        }
      />
    </div>
  );
}
