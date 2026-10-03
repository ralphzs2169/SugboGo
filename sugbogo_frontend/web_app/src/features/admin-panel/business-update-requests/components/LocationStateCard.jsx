/** Shows one location and landmark snapshot when a pending baseline is stale. */
export default function LocationStateCard({ title, snapshot }) {
  const location = snapshot?.location;
  return (
    <article className="min-w-0 rounded-lg border border-stroke bg-surface p-4">
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      <p className="mt-3 break-words text-sm text-text-primary">
        {location?.address || "Address unavailable"}
      </p>
      <p className="mt-1 text-xs text-text-secondary">
        {[location?.city, location?.province, location?.postal_code]
          .filter(Boolean)
          .join(", ")}
      </p>
      <p className="mt-2 text-xs tabular-nums text-text-secondary">
        {location?.latitude}, {location?.longitude}
      </p>
      <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Landmarks ({snapshot?.landmarks?.length ?? 0})
      </h4>
      {snapshot?.landmarks?.length ? (
        <ul className="mt-2 space-y-2 text-sm text-text-primary">
          {snapshot.landmarks.map((landmark, index) => (
            <li
              key={`${landmark.id ?? landmark.place_id ?? landmark.name}-${index}`}
            >
              {landmark.name}
              {landmark.address && (
                <span className="block text-xs text-text-secondary">
                  {landmark.address}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-text-secondary">None</p>
      )}
    </article>
  );
}
