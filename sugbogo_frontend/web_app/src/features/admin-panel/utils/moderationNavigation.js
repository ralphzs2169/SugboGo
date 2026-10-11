export function getLegacyModerationDestination(search, tab) {
  const searchParams = new URLSearchParams(search);

  searchParams.set("tab", tab);

  return {
    pathname: "/admin-panel/moderation-integrity",
    search: `?${searchParams.toString()}`,
  };
}
