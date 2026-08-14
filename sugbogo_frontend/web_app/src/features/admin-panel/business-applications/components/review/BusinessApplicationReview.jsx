import ApplicationReviewHeader from "./ApplicationReviewHeader";
import BusinessDocumentsReview from "./BusinessDocumentsReview";
import BusinessHoursReview from "./BusinessHoursReview";
import BusinessIdentityReview from "./BusinessIdentityReview";
import BusinessLocationReview from "./BusinessLocationReview";
import BusinessPhotosReview from "./BusinessPhotosReview";
import GoogleMapsProvider from "../../../providers/GoogleMapsProvider";
import ApplicationReviewContextBar from "./ReviewContextBar";
import RejectApplicationDrawer from "./RejectApplicationDrawer";
import ApproveApplicationConfirmationModal from "./ApproveApplicationConfirmationModal";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { fetchBusinessApplicationDocumentPreview } from "../../services/businessApplicationService";

import Button from "@/shared/components/Button";
import useApproveBusinessApplication from "../../hooks/useApproveBusinessApplication";

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
  const [showContextBar, setShowContextBar] = useState(false);

  const [documentPreviewUrls, setDocumentPreviewUrls] = useState({});

  const [isRejectDrawerOpen, setIsRejectDrawerOpen] = useState(false);
  const [isApproveConfirmationOpen, setIsApproveConfirmationOpen] =
    useState(false);

  const { approveApplication, isSubmitting: isApproving } =
    useApproveBusinessApplication();

  const businessName =
    application.identity?.business_name || "Unnamed Business";

  const isResolved = ["approved", "rejected"].includes(application.status);
  const isResubmission = application.status === "submitted";

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
      await approveApplication(application.id);

      toast.success("Application approved successfully.");

      setIsApproveConfirmationOpen(false);

      onApplicationApproved?.();
    } catch (error) {
      console.error("Failed to approve application:", error);

      toast.error(
        error.response?.data?.message ||
          "The application could not be approved. Please try again.",
      );
    }
  }

  return (
    <div className="space-y-6 ">
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
      <GoogleMapsProvider>
        <BusinessLocationReview
          location={application.location}
          feedback={getSectionFeedback("location")}
          isChangedSinceLastReview={hasSectionChanged("location")}
          isResubmission={isResubmission}
        />
      </GoogleMapsProvider>

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

      {!isResolved && (
        <>
          {/* Fixed decision area */}
          <div className="h-2" />
          <section
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
                  onClick={() => setIsRejectDrawerOpen(true)}
                >
                  Request Changes
                </Button>

                <Button
                  type="button"
                  variant="success"
                  onClick={() => setIsApproveConfirmationOpen(true)}
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
        isOpen={isRejectDrawerOpen}
        applicationId={application.id}
        onClose={() => setIsRejectDrawerOpen(false)}
        onSuccess={onApplicationRejected}
        businessName={businessName}
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
      />
    </div>
  );
}
