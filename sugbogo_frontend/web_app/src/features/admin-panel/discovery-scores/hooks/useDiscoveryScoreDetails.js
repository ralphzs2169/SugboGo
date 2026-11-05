import { useQuery } from "@tanstack/react-query";
import {
  discoveryScoreDetailOptions,
  visibilityDiagnosticOptions,
} from "../services/discoveryScoreService";

/** Expose independently recoverable persisted detail and current visibility queries. */
export default function useDiscoveryScoreDetails(businessId) {
  const detail = useQuery(discoveryScoreDetailOptions(businessId));
  const diagnostic = useQuery(visibilityDiagnosticOptions(businessId));
  return { detail, diagnostic };
}
