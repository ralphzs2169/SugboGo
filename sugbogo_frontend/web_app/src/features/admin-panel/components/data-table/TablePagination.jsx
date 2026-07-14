import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Navigation and metadata status footer component for the table system framework.
 * Displays navigation controls alongside item count boundaries.
 *
 * @component
 * @param {string} footerMetaText - Informational string representing row status (e.g., "Showing 1 to 4 of 124").
 */
function TablePagination({ footerMetaText }) {
  return (
    <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-stroke/40">
      <p className="text-[11px] font-medium text-text-secondary">
        {footerMetaText}
      </p>

      <div className="flex items-center gap-1">
        <button className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f27e13] text-white text-xs font-bold shadow-sm">
          1
        </button>
        <button className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default TablePagination;
