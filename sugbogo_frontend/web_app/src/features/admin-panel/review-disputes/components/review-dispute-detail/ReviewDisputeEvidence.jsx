import { ExternalLink, FileSearch } from "lucide-react";

import { formatLabel } from "@/shared/utils/stringUtils";

/**
 * Displays dispute evidence in a structured card with image thumbnails and
 * document indicators, opening each evidence file in a new browser tab.
 */
export default function ReviewDisputeEvidence({ evidence = [] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-stroke bg-background">
      {/* Section header */}
      <div className="flex items-center justify-between border-b border-stroke bg-metric-header px-5 py-4">
        <h2 className="text-sm font-semibold text-text-primary">Evidence</h2>

        <span className="text-xs font-medium text-text-secondary">
          {evidence.length} {evidence.length === 1 ? "file" : "files"}
        </span>
      </div>

      {/* Evidence content */}
      <div className="p-5">
        {evidence.length === 0 ? (
          /* Empty evidence state */
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-text-secondary">
              <FileSearch className="h-4 w-4" aria-hidden="true" />
            </div>

            <div>
              <p className="text-sm font-medium text-text-primary">
                No evidence submitted.
              </p>

              <p className="mt-0.5 text-xs text-text-secondary">
                The merchant did not attach supporting files to this dispute.
              </p>
            </div>
          </div>
        ) : (
          /* Evidence list */
          <div className="flex flex-wrap gap-3">
            {evidence.map((item, index) => {
              const isDocument = item.type === "document";
              const hasFileName = Boolean(item.file_name);
              const fileName = item.file_name || "Unnamed evidence";

              return (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${fileName}`}
                  className="group flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-lg border border-stroke px-3 py-3 transition-colors hover:bg-surface-muted sm:w-64"
                >
                  {/* Evidence preview */}
                  {isDocument ? (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-surface-muted text-[10px] font-bold uppercase text-text-secondary">
                      DOC
                    </div>
                  ) : (
                    <img
                      src={item.url}
                      alt={fileName || `Evidence image ${index + 1}`}
                      className="h-12 w-12 shrink-0 rounded-md object-cover"
                      loading="lazy"
                    />
                  )}

                  {/* Evidence information */}
                  <div className="min-w-0 flex-1">
                    <p
                      title={fileName}
                      className={`truncate text-sm font-semibold ${
                        hasFileName
                          ? "text-text-primary"
                          : "text-text-secondary"
                      }`}
                    >
                      {fileName}
                    </p>

                    <p className="mt-0.5 text-xs text-text-secondary">
                      {formatLabel(item.type)}
                    </p>
                  </div>

                  {/* External navigation indicator */}
                  <ExternalLink
                    size={14}
                    aria-hidden="true"
                    className="shrink-0 text-text-secondary transition-colors group-hover:text-text-primary"
                  />
                </a>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
