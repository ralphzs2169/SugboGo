import { readablePeriod } from "../utils/reportClarity";

/** Displays server-selected calendar dates consistently without changing query boundaries. */
export default function AnalyticsPeriodLabel({ period, children }) {
  return <p className="mb-3 text-xs leading-relaxed text-text-secondary"><span className="font-medium text-text-primary">{readablePeriod(period)}</span> · PHT{children}</p>;
}
