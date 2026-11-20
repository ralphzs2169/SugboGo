import { useContext, useEffect, useId } from "react";

import { isConnectionFailure, PageLoadContext } from "./PageLoadContext";

export default function usePageLoadFailures(section, queries) {
  const id = useId();
  const context = useContext(PageLoadContext);
  const register = context?.register;
  const failures = queries.filter((query) => query.error);
  const connectionFailures = failures.filter((query) =>
    query.refetch && isConnectionFailure(query.error),
  );

  useEffect(() => {
    register?.(id, section, connectionFailures);
  });

  useEffect(() => () => register?.(id, section, []), [id, register, section]);

  return context?.grouped
    ? failures.filter((query) => !isConnectionFailure(query.error))
    : failures;
}
