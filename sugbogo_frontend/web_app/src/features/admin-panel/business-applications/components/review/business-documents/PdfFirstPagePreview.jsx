import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * Renders the first page of a PDF as a compact document preview.
 *
 * Shows loading and failure states and keeps the preview read-only so
 * administrators can open the original document separately for inspection.
 */
export default function PdfFirstPagePreview({ url, fileName }) {
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    let loadingTask = null;

    async function renderFirstPage() {
      console.log("PDF PREVIEW URL RECEIVED:", url, typeof url);
      if (!url || !canvasRef.current) {
        return;
      }

      setStatus("loading");

      try {
        loadingTask = pdfjsLib.getDocument({ url });

        const pdf = await loadingTask.promise;

        if (cancelled) {
          return;
        }

        const page = await pdf.getPage(1);

        if (cancelled) {
          return;
        }

        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("Unable to access PDF preview canvas.");
        }

        const containerWidth = canvas.parentElement?.clientWidth || 240;
        const unscaledViewport = page.getViewport({ scale: 1 });

        const scale = Math.min(containerWidth / unscaledViewport.width, 1.5);

        const viewport = page.getViewport({ scale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,
          viewport,
        }).promise;

        if (!cancelled) {
          setStatus("ready");
        }
      } catch (error) {
        console.error("Failed to render PDF preview:", error);

        if (!cancelled) {
          setStatus("error");
        }
      }
    }

    renderFirstPage();

    return () => {
      cancelled = true;
      loadingTask?.destroy();
    };
  }, [url]);

  return (
    <div
      className="flex h-full w-full items-center justify-center overflow-hidden bg-surface-muted"
      aria-label={`Preview of ${fileName || "PDF document"}`}
    >
      {/* PDF preview */}
      <canvas
        ref={canvasRef}
        className={`max-h-full max-w-full object-contain ${
          status === "ready" ? "block" : "hidden"
        }`}
      />

      {/* Loading state */}
      {status === "loading" && (
        <div className="flex h-full w-full items-center justify-center">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-stroke border-t-primary" />
        </div>
      )}

      {/* Preview failure state */}
      {status === "error" && (
        <div className="flex h-full w-full items-center justify-center px-1.5 text-center">
          <p className="text-[10px] font-medium leading-tight text-text-secondary">
            Preview unavailable
          </p>
        </div>
      )}
    </div>
  );
}
