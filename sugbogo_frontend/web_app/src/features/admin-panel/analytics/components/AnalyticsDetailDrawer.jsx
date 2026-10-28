import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BadgeCheck, CalendarDays, Clock3, Database, Info, ShieldCheck, Store, Users, X } from "lucide-react";
import AnalyticsExactTable from "./AnalyticsExactTable";
import { growthPeriodLabel } from "../utils/growthPresentation";
import { formatCount, formatTimestamp } from "../utils/presentation";

/** Presents report methodology and exact values in one right-side modal with native focus containment. */
export default function AnalyticsDetailDrawer({ mode, onClose, report, interval, series }) {
  const ref = useRef(null);
  const titleId = useId();
  const panelRef = useRef(null);
  const backdropRef = useRef(null);
  const [displayMode, setDisplayMode] = useState(mode);
  if (mode && mode !== displayMode) setDisplayMode(mode);
  const savedFocus = useRef(null);
  const savedOverflow = useRef(null);
  const open = Boolean(mode);

  useEffect(() => {
    const dialog = ref.current;
    const animations = [];
    let timer;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const duration = reducedMotion || !panelRef.current.animate ? 0 : 300;

    function finishClose() {
      dialog.close();
      if (savedOverflow.current !== null) {
        document.body.style.overflow = savedOverflow.current;
        savedOverflow.current = null;
      }
      if (savedFocus.current?.isConnected) savedFocus.current.focus();
    }

    if (open) {
      if (!dialog.open) {
        savedFocus.current = document.activeElement;
        savedOverflow.current = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        dialog.showModal();
      }
    } else if (!dialog.open) {
      return undefined;
    }

    if (duration) {
      animations.push(panelRef.current.animate(
        [{ transform: open ? "translateX(100%)" : "translateX(0)" }, { transform: open ? "translateX(0)" : "translateX(100%)" }],
        { duration, easing: "ease-out", fill: "forwards" },
      ));
      animations.push(backdropRef.current.animate(
        [{ opacity: open ? 0 : 1 }, { opacity: open ? 1 : 0 }],
        { duration, fill: "forwards" },
      ));
    }
    if (!open) {
      if (duration) timer = setTimeout(finishClose, duration);
      else finishClose();
    }
    return () => {
      clearTimeout(timer);
      animations.forEach((animation) => animation.cancel());
    };
  }, [open, mode]);

  useEffect(() => () => {
    if (savedOverflow.current !== null) document.body.style.overflow = savedOverflow.current;
    if (savedFocus.current?.isConnected) savedFocus.current.focus();
  }, []);

  const meta = report?.meta;
  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden border-0 bg-transparent p-0 text-text-primary backdrop:bg-transparent"
    >
      {/* Fading backdrop and sliding decision-style panel */}
      <div ref={backdropRef} onClick={onClose} aria-hidden="true" className="absolute inset-0 cursor-pointer bg-black/40" />
      <div ref={panelRef} className="relative ml-auto flex h-full w-full max-w-lg flex-col border-l border-stroke bg-background shadow-xl">
        {/* Fixed drawer heading and close action */}
        <header className="flex items-center justify-between gap-3 border-b border-stroke p-5">
          <h2 id={titleId} className="flex items-center gap-2 text-lg font-semibold">
            {displayMode === "about" ? "About Platform Growth" : "Platform Growth — Exact Data"}
          </h2>
          <button
            type="button"
            aria-label="Close Platform Growth details"
            onClick={onClose}
            className="cursor-pointer rounded p-2 text-text-secondary transition-colors hover:bg-stroke/50 hover:text-text-primary focus-visible:outline-2 focus-visible:outline-info"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </header>
        {/* Scrollable report details preserve dashboard position */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 text-sm">
          <p className="flex items-center gap-2 text-xs text-text-secondary"><CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0" />{meta?.period ? `${meta.period.start_date} – ${meta.period.end_date} · ${displayMode === "data" ? interval : meta.period.timezone}` : "Reporting dates unavailable"}</p>
          {displayMode === "about" ? <>
            <h3 className="text-xs font-semibold uppercase text-text-secondary">Report details</h3>
            <dl className="space-y-4 rounded-xl bg-surface p-4">
              {[
                ["Compared with", growthPeriodLabel(meta?.period?.previous_start, meta?.period?.previous_end_exclusive), CalendarDays],
                ["Report generated", formatTimestamp(meta?.generated_at), Clock3],
                ["Data through", formatTimestamp(meta?.data_through), CalendarDays],
                ["Source availability", meta?.availability ?? "Unavailable", Database],
                ["Coverage verified", meta?.coverage_verified === true ? "Yes" : meta?.coverage_verified === false ? "No" : "Unknown", ShieldCheck],
              ].map(([label, value, Icon]) => (
                <div key={label} className="flex items-start gap-3">
                  <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" />
                  <div>
                  <dt className="text-xs text-text-secondary">{label}</dt>
                  <dd className="mt-1 font-medium capitalize">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>
            <div className="space-y-4 border-t border-stroke pt-5">
              <h3 className="text-xs font-semibold uppercase text-text-secondary">How these metrics work</h3>
              {series.map((item) => (
                <div key={item.key} className="flex items-start gap-3">
                  <span className="rounded-lg bg-primary/10 p-2 text-primary">
                    {item.key === "new_consumer_accounts" ? <Users aria-hidden="true" className="h-4 w-4" /> : item.key === "new_businesses" ? <Store aria-hidden="true" className="h-4 w-4" /> : <BadgeCheck aria-hidden="true" className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0">
                  <h4 className="font-medium">{item.label}</h4>
                  <p className="mt-1 text-text-secondary">
                    {report?.definitions?.[item.key === "new_consumer_accounts" ? "consumer_accounts" : item.key] ?? "Definition unavailable"}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    Previous period: {formatCount(report?.activity?.[item.key]?.previous_value)}
                  </p>
                  </div>
                </div>
              ))}
              <p className="flex items-start gap-2 text-xs leading-relaxed text-text-secondary"><Info aria-hidden="true" className="h-4 w-4 shrink-0" />{report?.definitions?.comparisons}</p>
            </div>
          </> : (
            <AnalyticsExactTable
              caption="Platform Growth exact reporting buckets"
              rows={report?.series}
              columns={[
                { key: "date", label: "Calendar bucket" },
                ...series.map((item) => ({
                  key: item.key,
                  label: item.label,
                  render: (row) => formatCount(row[item.key]),
                })),
              ]}
            />
          )}
        </div>
      </div>
    </dialog>, document.body,
  );
}
