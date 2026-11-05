import { Navigate, useLocation } from "react-router-dom";
import { getLegacyTaxonomyDestination } from "../../utils/taxonomyNavigation";

/** Replace a legacy management URL without leaving a duplicate page in history. */
export default function LegacyTaxonomyRedirect({ tab }) {
  const location = useLocation();
  return (
    <Navigate
      to={{
        ...getLegacyTaxonomyDestination(location.search, tab),
        hash: location.hash,
      }}
      replace
    />
  );
}
