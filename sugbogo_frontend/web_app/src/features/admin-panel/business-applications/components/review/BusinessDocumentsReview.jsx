import { ExternalLink, FileText } from "lucide-react";

import ApplicationReviewSection from "./ApplicationReviewSection";
import PdfFirstPagePreview from "./business-documents/PdfFirstPagePreview";
import ApplicationReviewFeedback from "./ApplicationReviewFeedback";
/**
 * Displays verification documents submitted with the merchant application.
 *
 * Provides compact first-page previews while keeping each document directly
 * accessible for detailed administrative inspection.
 */
export default function BusinessDocumentsReview({
  documents = [],
  feedback,
  isResubmission = false,
}) {
  return (
    <ApplicationReviewSection
      icon={FileText}
      title="Verification Documents"
      description="Inspect the supporting documents submitted for verification."
    >
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
              className="flex items-center gap-4 bg-surface px-4 py-4"
            >
              {/* PDF preview */}
              <a
                href={document.document_url}
                target="_blank"
                rel="noreferrer"
                className="block h-20 w-16 shrink-0 cursor-pointer overflow-hidden rounded border border-stroke bg-surface-muted"
                aria-label={`Open ${document.file_name || "document"}`}
              >
                <PdfFirstPagePreview
                  url={document.document_url}
                  fileName={document.file_name}
                />
              </a>

              {/* Document information */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium capitalize text-text-primary">
                  {document.document_type?.replaceAll("_", " ") ||
                    "Verification document"}
                </p>

                <p className="mt-1 truncate text-xs text-text-secondary">
                  {document.file_name || "Unnamed document"}
                </p>
              </div>

              {/* Open original document */}
              <a
                href={document.document_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-stroke px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover"
              >
                View
                <ExternalLink className="h-4 w-4" />
              </a>
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
