import { useState } from "react";

/**
 * Displays dispute evidence as accessible external links and allows
 * administrators to expand the list when more evidence is available.
 */
export default function ReviewDisputeEvidence({ evidence = [] }) {
  const [showAllEvidence, setShowAllEvidence] = useState(false);

  const formatLabel = (value) => {
    if (!value) {
      return "—";
    }

    return value.replaceAll("_", " ");
  };

  const visibleEvidence = showAllEvidence ? evidence : evidence.slice(0, 3);

  return (
    <section>
      {/* Evidence heading */}
      <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-text-secondary">
        Evidence
      </h2>

      {/* Evidence list */}
      <div className="rounded-xl border border-stroke bg-background p-5">
        {evidence.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {visibleEvidence.map((item, index) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-40 cursor-pointer items-center gap-3 rounded-lg border border-stroke px-4 py-3 transition-colors hover:bg-surface-muted"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-muted text-[10px] font-bold uppercase text-text-secondary">
                  {item.type === "document" ? "DOC" : "IMG"}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-primary">
                    {item.type === "document"
                      ? `Document ${index + 1}`
                      : `Image ${index + 1}`}
                  </p>

                  <p className="mt-0.5 text-xs capitalize text-text-secondary">
                    {formatLabel(item.type)}
                  </p>
                </div>
              </a>
            ))}

            {/* Evidence expansion controls */}
            {!showAllEvidence && evidence.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAllEvidence(true)}
                className="cursor-pointer px-2 text-sm font-semibold text-text-secondary hover:text-text-primary hover:underline"
              >
                + view {evidence.length - 3} more
              </button>
            )}

            {showAllEvidence && evidence.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAllEvidence(false)}
                className="cursor-pointer px-2 text-sm font-semibold text-text-secondary hover:text-text-primary hover:underline"
              >
                Show less
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">
            No evidence was submitted.
          </p>
        )}
      </div>
    </section>
  );
}
