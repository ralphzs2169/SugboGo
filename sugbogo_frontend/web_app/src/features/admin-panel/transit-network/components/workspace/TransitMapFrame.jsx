import { LoaderCircle, MapPin } from "lucide-react";

/** Preserve the workspace size while map loading and recovery happen in place. */
export default function TransitMapFrame({ isFullscreen, canMountMap, notice, children }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-stroke-strong bg-surface ${
        isFullscreen
          ? "h-[65vh] min-h-[420px] xl:h-full xl:min-h-0"
          : "h-[72vh] min-h-[560px]"
      } xl:col-start-2`}
    >
      {canMountMap && (
        <div className="h-full w-full" inert={Boolean(notice)}>
          {children}
        </div>
      )}
      {notice && <TransitMapNotice notice={notice} />}
    </div>
  );
}

/** Keep map recovery instructions visible in the existing workspace panel. */
function TransitMapNotice({ notice }) {
  const isLoading = notice.kind === "loading";
  const Icon = isLoading ? LoaderCircle : MapPin;

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-surface p-6"
      role={isLoading ? "status" : "alert"}
      aria-live={isLoading ? "polite" : "assertive"}
    >
      <div className="max-w-sm text-center">
        <Icon
          className={`mx-auto h-8 w-8 text-text-secondary ${isLoading ? "motion-safe:animate-spin" : ""}`}
          aria-hidden="true"
        />
        <h2 className="mt-3 text-sm font-semibold text-text-primary">{notice.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          {notice.description}
        </p>
        {!isLoading && (
          <p className="mt-3 text-xs leading-relaxed text-text-secondary">
            Route records are still available in the side panels. Finish or cancel
            unsaved edits before reloading.
          </p>
        )}
      </div>
    </div>
  );
}
