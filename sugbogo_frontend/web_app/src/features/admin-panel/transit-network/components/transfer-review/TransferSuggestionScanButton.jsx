import toast from "react-hot-toast";
import { ScanSearch } from "lucide-react";

import Button from "@/shared/components/Button";

import useTransitMutations from "../../hooks/useTransitMutations";

/**
 * Runs transfer candidate detection and reports the persisted scan result.
 */
export default function TransferSuggestionScanButton() {
  const { detectTransferCandidates, isDetectingTransferCandidates } =
    useTransitMutations();

  async function handleScan() {
    try {
      const summary = await detectTransferCandidates();
      const createdCount = summary.candidates_created;
      const existingCount = summary.candidates_skipped_existing;

      if (createdCount > 0) {
        toast.success(
          `${createdCount} new transfer suggestion${
            createdCount === 1 ? "" : "s"
          } found.`,
        );
        return;
      }

      const existingSummary = existingCount
        ? ` ${existingCount} existing connection${
            existingCount === 1 ? " was" : "s were"
          } kept.`
        : "";

      toast(`No new transfer suggestions found.${existingSummary}`);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Transfer suggestions could not be scanned. Please try again.",
      );
    }
  }

  return (
    <Button
      variant="secondary"
      icon={ScanSearch}
      loading={isDetectingTransferCandidates}
      onClick={handleScan}
    >
      Scan for Suggestions
    </Button>
  );
}
