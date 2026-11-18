import { ExternalLink, FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import { fetchBusinessApplicationDocumentPreview } from "../../services/businessApplicationService";
import ApplicationReviewSection from "./ApplicationReviewSection";
import ApplicationReviewFeedback from "./ApplicationReviewFeedback";
import DocumentPreview from "./business-documents/DocumentPreview";
import ApplicationReviewChangeStatus from "./ApplicationReviewChangeStatus";
/**
 * Displays verification documents submitted with the merchant application.
 *
 * Provides compact first-page previews while keeping each document directly
 * accessible for detailed administrative inspection.
 */
export default function BusinessDocumentsReview({
  applicationId,
  documents = [],
  documentPreviewUrls = {},
  feedback,
  isChangedSinceLastReview = false,
  isResubmission = false,
}) {
  const pendingPreview = useRef(null);
  const [openingDocumentId, setOpeningDocumentId] = useState(null);

  useEffect(() => () => {
    const pending = pendingPreview.current;
    pending?.controller.abort();
    pending?.tab.close();
  }, []);

  /** Opens a browser-local copy after a fresh, authenticated preview request. */
  async function openDocument(documentId) {
    if (pendingPreview.current) return;

    const tab = window.open("", "_blank");
    if (!tab) {
      toast.error("Allow pop-ups to open this verification document.");
      return;
    }

    tab.opener = null;
    tab.document.body.textContent = "Opening verification document…";
    const controller = new AbortController();
    pendingPreview.current = { tab, controller };
    setOpeningDocumentId(documentId);

    try {
      const blob = await fetchBusinessApplicationDocumentPreview(
        applicationId,
        documentId,
        controller.signal,
      );
      if (tab.closed || controller.signal.aborted) return;

      const url = URL.createObjectURL(blob);
      try {
        tab.location.replace(url);
      } catch (error) {
        URL.revokeObjectURL(url);
        throw error;
      }

      // The browser's PDF viewer may keep reading the file while the tab is open.
      const cleanup = window.setInterval(() => {
        if (tab.closed) {
          URL.revokeObjectURL(url);
          window.clearInterval(cleanup);
        }
      }, 1000);
    } catch {
      tab.close();
      if (!controller.signal.aborted) {
        toast.error("Unable to open the verification document. Try again.");
      }
    } finally {
      pendingPreview.current = null;
      if (!controller.signal.aborted) setOpeningDocumentId(null);
    }
  }

  return (
    <ApplicationReviewSection
      icon={FileText}
      title="Verification Documents"
      description="Inspect the supporting documents submitted for verification."
    >
      <ApplicationReviewChangeStatus
        feedback={feedback}
        isChangedSinceLastReview={isChangedSinceLastReview}
        isResubmission={isResubmission}
      />
      <ApplicationReviewFeedback
        feedback={feedback}
        isResubmission={isResubmission}
      />
      {documents.length ? (
        /* Submitted documents */
        <div className="divide-y divide-stroke overflow-hidden rounded-lg border border-stroke">
          {documents.map((document) => (
            <div
              key={document.id}
              className="flex items-center gap-3 bg-surface px-3 py-3"
            >
              {/* Document preview */}
              <button
                type="button"
                onClick={() => openDocument(document.id)}
                disabled={openingDocumentId !== null}
                className="block h-14 w-11 shrink-0 cursor-pointer overflow-hidden rounded border border-stroke bg-surface-muted"
                aria-label={`Open ${document.file_name || "document"}`}
              >
                <DocumentPreview
                  url={documentPreviewUrls[document.id]}
                  fileName={document.file_name}
                />
              </button>

              {/* Document information */}
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium capitalize text-text-primary">
                  {document.document_type?.replaceAll("_", " ") ||
                    "Verification document"}
                </p>

                <p className="mt-1 truncate text-xs text-text-secondary">
                  {document.file_name || "Unnamed document"}
                </p>
              </div>

              {/* Open original document */}
              <button
                type="button"
                aria-label={`View ${document.file_name || "verification document"}`}
                aria-busy={openingDocumentId === document.id}
                onClick={() => openDocument(document.id)}
                disabled={openingDocumentId !== null}
                className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-stroke px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover"
              >
                {openingDocumentId === document.id ? "Opening…" : "View"}
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        /* Empty state */
        <div className="rounded-lg border border-stroke bg-surface-muted p-5">
          <p className="text-sm font-medium text-text-primary">
            No verification documents submitted
          </p>

          <p className="mt-1 text-sm text-text-secondary">
            The applicant did not provide any supporting verification documents.
          </p>
        </div>
      )}
    </ApplicationReviewSection>
  );
}
