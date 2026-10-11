import ReviewDirectionIndicator from "./ReviewDirectionIndicator";

function LocationValue({ location, requested = false }) {
  const locality = [
    location?.unit,
    location?.street_address,
    location?.barangay,
    location?.city,
    location?.province,
    location?.postal_code,
  ].filter(Boolean);

  return (
    <>
      <p
        className={`mt-3 break-words leading-7 text-text-primary ${requested ? "text-xl font-bold" : "text-lg font-medium"}`}
      >
        {location?.address || "Address unavailable"}
      </p>

      {locality.length > 0 && (
        <p className="mt-2 break-words text-xs leading-5 text-text-secondary">
          {locality.join(" · ")}
        </p>
      )}

      <p className="mt-3 break-words font-mono text-xs tabular-nums text-text-secondary">
        Lat {location?.latitude ?? "—"} · Lng {location?.longitude ?? "—"}
      </p>
    </>
  );
}

/** Compares captured addresses and exact coordinates without using live data. */
export default function LocationRequestedChanges({
  previous,
  proposed,
  status,
}) {
  return (
    <div>
      <h4 className="mb-3 text-sm font-semibold text-text-primary">
        Business location
      </h4>

      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
        {/* Captured location at submission */}
        <div className="min-w-0 rounded-xl bg-surface p-5">
          <p className="text-xs font-medium text-text-secondary">
            At submission
          </p>
          <LocationValue location={previous} />
        </div>

        <ReviewDirectionIndicator />

        {/* Merchant's immutable proposal */}
        <div className="min-w-0 rounded-xl border border-stroke bg-background p-5 shadow-sm">
          <p className="text-xs font-semibold text-text-secondary">
            {status === "approved" ? "Approved location" : "Requested location"}
          </p>
          <LocationValue location={proposed} requested />
        </div>
      </div>
    </div>
  );
}
