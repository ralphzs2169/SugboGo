import { useState, useCallback } from "react";
import { AlertCircle } from "lucide-react";

import Button from "@/shared/components/Button";

import { PageLoadContext } from "./PageLoadContext";
import usePageLoadFailures from "./usePageLoadFailures";

export function PageLoadScope({ children }) {
  const [sources, setSources] = useState({});

  const register = useCallback((id, section, failures) => {
    setSources((previous) => {
      const source = previous[id];

      if (!failures.length) {
        if (!source) return previous;

        const next = { ...previous };
        delete next[id];
        return next;
      }

      if (
        source &&
        source.section === section &&
        source.failures.length === failures.length &&
        source.failures.every((failure, index) => {
          const next = failures[index];
          return (
            failure.error === next.error &&
            failure.refetch === next.refetch &&
            failure.isFetching === next.isFetching &&
            (failure.data != null) === (next.data != null)
          );
        })
      ) {
        return previous;
      }

      return { ...previous, [id]: { section, failures } };
    });
  }, []);

  const groups = Object.values(sources);
  const affectedSections = new Set(
    groups.map((source) => source.section).filter(Boolean),
  );
  const grouped = affectedSections.size > 1;

  return (
    <PageLoadContext.Provider value={{ register, grouped }}>
      <PageLoadNotice
        failures={grouped ? groups.flatMap((source) => source.failures) : []}
      />
      {children}
    </PageLoadContext.Provider>
  );
}

function PageLoadNotice({ failures }) {
  const [retrying, setRetrying] = useState(false);

  async function retry() {
    setRetrying(true);

    try {
      const requests = new Set(failures.map((failure) => failure.refetch));
      await Promise.allSettled(
        Array.from(requests, (refetch) => refetch({ cancelRefetch: false })),
      );
    } finally {
      setRetrying(false);
    }
  }

  if (!failures.length && !retrying) return null;

  const hasMissingData = failures.some((failure) => failure.data == null);
  let message = "Unable to reach SugboGo. Showing previously loaded data.";

  if (retrying) {
    message = "Retrying failed requests…";
  } else if (hasMissingData) {
    message = "Unable to reach SugboGo. Some page data is unavailable.";
  }

  return (
    <div className="mb-4">
      <LoadNotice
        message={message}
        retryLabel="Retry failed requests"
        retrying={retrying || failures.some((failure) => failure.isFetching)}
        onRetry={retry}
      />
    </div>
  );
}

function LoadNotice({
  message,
  retryLabel = "Retry",
  retrying = false,
  onRetry,
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-surface-muted px-3 py-2 text-sm text-text-secondary">
      <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
      <p role="status" className="min-w-0 flex-1 basis-36">{message}</p>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          loading={retrying}
          aria-busy={retrying}
        >
          {retrying ? "Retrying…" : retryLabel}
        </Button>
      )}
    </div>
  );
}

export function LoadGroupFeedback({
  section,
  queries,
  label,
  retryLabel,
  errorMessage,
  refreshMessage,
}) {
  const localFailures = usePageLoadFailures(section, queries);

  if (!localFailures.length) return null;

  const hasRetainedData = localFailures.some((query) => query.data != null);
  const unavailable = localFailures.some((query) => query.data == null);
  let message = errorMessage ?? `Unable to load ${label.toLowerCase()}.`;

  if (hasRetainedData) {
    if (unavailable) {
      message = `${message} Previously loaded data is still shown.`;
    } else {
      message = refreshMessage ?? `${label} couldn’t refresh. Showing previously loaded data.`;
    }
  }

  return (
    <LoadNotice
      message={message}
      retryLabel={retryLabel}
      retrying={localFailures.some((query) => query.isFetching)}
      onRetry={() => {
        for (const query of localFailures) {
          void query.refetch({ cancelRefetch: false });
        }
      }}
    />
  );
}
