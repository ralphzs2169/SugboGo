import { Info } from "lucide-react";
import Tooltip from "@/shared/components/actions/Tooltip";
import MetricCard from "../../components/MetricCard";

/** Keeps short Operations explanations available to pointer, touch and keyboard users. */
export function OperationsHelp({ label, children }) {
  return (
    <Tooltip content={children} place="top" asChild openOnClick
      closeEvents={{ blur: true }}
      globalCloseEvents={{ escape: true, clickOutsideAnchor: true, scroll: true, resize: true }}
      className="!z-50 max-w-[min(20rem,calc(100vw-2rem))] whitespace-normal !px-3 !py-2 leading-relaxed"
    >
      {/* Named help action uses the existing Analytics tooltip interaction. */}
      <button type="button" aria-label={label} className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded text-text-secondary hover:bg-surface-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info">
        <Info aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </Tooltip>
  );
}

/** Gives operational values prominence in a compact two-column grid. */
export default function OperationsStats({ items }) {
  return (
    <div className="grid min-w-0 grid-cols-2 gap-3">
      {items.map((item) => (
        <MetricCard
          key={item.label}
          title={item.label}
          value={item.value}
          footerValue={item.footerValue}
          measurementLabel={item.context}
          compact
          dense
          wrapTitle
          headerAction={item.help && (
            <OperationsHelp label={`About ${item.label}`}>{item.help}</OperationsHelp>
          )}
        />
      ))}
    </div>
  );
}
