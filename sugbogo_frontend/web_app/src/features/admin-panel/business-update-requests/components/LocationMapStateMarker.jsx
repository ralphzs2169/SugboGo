const STATE_STYLES = {
  previous: "bg-amber-600",
  proposed: "bg-emerald-700",
  current: "bg-sky-700",
};

const STATE_INITIALS = {
  previous: "P",
  proposed: "R",
  current: "C",
};

/** Marks one true map position, including all states sharing that coordinate. */
export default function LocationMapStateMarker({ states, compact = false }) {
  return (
    <div
      className="flex flex-col items-center"
      aria-label={states.map((state) => state.label).join(" and ")}
    >
      <div className="flex items-center gap-0.5 rounded-full border-2 border-white bg-white p-0.5 shadow-lg">
        {states.map((state) => (
          <span
            key={state.id}
            className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${STATE_STYLES[state.id] || "bg-slate-700"} ${compact ? "h-5 w-5 text-[10px]" : "h-7 w-7 text-xs"}`}
            title={state.label}
          >
            {STATE_INITIALS[state.id] || state.label.charAt(0)}
          </span>
        ))}
      </div>
      {!compact && (
        <span
          className="h-0 w-0 border-x-[6px] border-t-[8px] border-x-transparent border-t-white"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
