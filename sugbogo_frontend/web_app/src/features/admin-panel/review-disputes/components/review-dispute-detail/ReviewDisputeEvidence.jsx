import { safeHttpUrl } from "@/shared/utils/safeUrl";
import { ExternalLink, FileSearch, FileText } from "lucide-react";

import { formatLabel } from "@/shared/utils/stringUtils";

/**
 * Displays dispute evidence with image thumbnails and
 * document indicators, opening each evidence file in a new browser tab.
 */
export default function ReviewDisputeEvidence({ evidence = [] }) {
  return (
    <section
      aria-label="Dispute evidence"
      className="border-t border-stroke pt-5"
    >
      {/* Section header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileSearch
            className="h-4 w-4 text-text-secondary"
            strokeWidth={1.75}
            aria-hidden="true"
          />

          <h2 className="text-base font-semibold text-text-primary">
            Evidence
          </h2>
        </div>

        <span className="shrink-0 text-xs font-medium text-text-secondary">
          {evidence.length} {evidence.length === 1 ? "file" : "files"}
        </span>
      </div>

      {/* Evidence content */}
      <div className="mt-4">
        {evidence.length === 0 ? (
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">
                No evidence submitted.
              </p>

              <p className="mt-0.5 text-xs text-text-secondary">
                The merchant did not attach supporting files to this dispute.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {evidence.map((item, index) => {
              const isDocument = item.type === "document";
              const hasFileName = Boolean(item.file_name);
              const fileName = item.file_name || "Unnamed evidence";

              return (
                <a
                  key={item.id}
                  href={safeHttpUrl(item.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${fileName}`}
                  className="
                    group flex w-full min-w-0 items-center gap-3
                    rounded-lg border border-stroke px-3 py-3
                    transition-colors hover:bg-interaction-hover
                    focus-visible:outline focus-visible:outline-2
                    focus-visible:outline-offset-2
                    focus-visible:outline-primary
                    sm:w-64
                  "
                >
                  {/* Evidence preview */}
                  {isDocument ? (
                    <div
                      className="
                        flex h-12 w-12 shrink-0 items-center
                        justify-center rounded-md bg-surface-muted
                        text-[10px] font-bold uppercase
                        text-text-secondary
                      "
                    >
                      DOC
                    </div>
                  ) : (
                    <img
                      src={safeHttpUrl(item.url)}
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

                  <ExternalLink
                    className="
                      h-3.5 w-3.5 shrink-0 text-text-secondary
                      transition-colors group-hover:text-primary
                    "
                    strokeWidth={1.75}
                    aria-hidden="true"
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
