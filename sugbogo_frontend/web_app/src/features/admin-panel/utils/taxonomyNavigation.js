const TAXONOMY_TABS = ["clusters", "categories", "specialty-tags"];

/** Resolve an existing combined-page tab to its new management destination. */
export function getLegacyTaxonomyDestination(search, tab) {
  const searchParams = new URLSearchParams(search);
  const selectedTab = tab ?? searchParams.get("tab") ?? "clusters";

  if (selectedTab === "discovery-shortcuts") {
    searchParams.delete("tab");
    const query = searchParams.toString();
    return {
      pathname: "/admin-panel/explore-configuration",
      search: query ? `?${query}` : "",
    };
  }

  searchParams.set(
    "tab",
    TAXONOMY_TABS.includes(selectedTab) ? selectedTab : "clusters",
  );
  return {
    pathname: "/admin-panel/business-taxonomy",
    search: `?${searchParams.toString()}`,
  };
}
