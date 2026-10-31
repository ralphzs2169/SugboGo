import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import toast from "react-hot-toast";
import SortMenu from "../../components/data-table/SortMenu";
import Tooltip from "@/shared/components/actions/Tooltip";
import { MAP_PDF_UNAVAILABLE, printAnalyticsTab } from "../utils/tabPdfExport";

/** Opens the browser PDF workflow for the mounted workspace without fetching or resetting reports. */
export default function AnalyticsPdfExport({ active, title, period }) {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const wrapper = useRef(null);
  async function exportPdf() {
    if (running.current) return;
    if (active === "business-ecosystem") {
      toast.error(MAP_PDF_UNAVAILABLE);
      return;
    }
    const source = document.getElementById(`analytics-topics-panel-${active}`);
    const reportName = { "growth-discovery": "platformGrowth", operations: "onboarding", "community-trust": "communityHealth" }[active];
    const query = client.getQueryCache().findAll().find((entry) => entry.queryKey[2] === reportName && Object.entries(period).every(([key, value]) => String(entry.queryKey[3]?.[key]) === String(value)));
    const dates = query?.state.data?.processing_meta?.period ?? query?.state.data?.meta?.period;
    if (!dates || !source || source.querySelector('[aria-busy="true"]')) {
      toast.error("Wait for the active reports to finish loading before exporting.");
      return;
    }
    running.current = true;
    setBusy(true);
    try {
      toast("Choose Save as PDF in the print dialog. Your browser controls the destination and final filename.");
      await printAnalyticsTab(source, { tab: active, title, period: dates });
    } catch (error) {
      toast.error(error.message || "The PDF could not be prepared. Please try again.");
    } finally {
      running.current = false;
      setBusy(false);
      window.requestAnimationFrame(() => wrapper.current?.querySelector("button")?.focus({ preventScroll: true }));
    }
  }
  const menu = <SortMenu ariaLabel="Analytics export" triggerLabel={busy ? "Preparing PDF…" : "Export"} icon={Download} value="" disabled={busy || active === "business-ecosystem"} options={[{ value: "pdf", label: "Export current tab as PDF" }]} onChange={exportPdf} />;
  return (
    <div ref={wrapper}>
      {/* The wrapper supports hover and keyboard focus while the button stays disabled. */}
      {active === "business-ecosystem" ? (
        <Tooltip asChild place="bottom" content={MAP_PDF_UNAVAILABLE}
          closeEvents={{ mouseleave: true, blur: true }} globalCloseEvents={{ escape: true, clickOutsideAnchor: true, scroll: true, resize: true }}
          className="!z-50 max-w-[min(22rem,calc(100vw-2rem))] whitespace-normal !px-3 !py-2 leading-relaxed">
          <div tabIndex={0} role="group" aria-label="Analytics PDF export unavailable" className="inline-flex cursor-not-allowed rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info">
            {menu}
          </div>
        </Tooltip>
      ) : menu}
    </div>
  );
}
