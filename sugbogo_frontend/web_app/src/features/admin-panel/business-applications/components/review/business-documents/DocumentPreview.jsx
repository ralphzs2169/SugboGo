import PdfFirstPagePreview from "./PdfFirstPagePreview";

/**
 * Renders a compact preview for a verification document.
 *
 * Uses PDF.js for PDF documents and a native image element for
 * image-based verification documents.
 */
export default function DocumentPreview({ url, fileName }) {
  if (!url) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-muted">
        <p className="px-1.5 text-center text-[10px] font-medium leading-tight text-text-secondary">
          Preview unavailable
        </p>
      </div>
    );
  }

  const extension = fileName?.split(".").pop()?.toLowerCase();

  const isPdf = extension === "pdf";

  if (isPdf) {
    return <PdfFirstPagePreview url={url} fileName={fileName} />;
  }

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden bg-surface-muted">
      <img
        src={url}
        alt={fileName || "Verification document"}
        className="h-full w-full object-contain"
      />
    </div>
  );
}
