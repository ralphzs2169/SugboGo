/**
 * Safely updates or clears a column filter inside TanStack's filtering state array.
 * @param {string} id - The column accessor key (e.g., 'cluster', 'status')
 * @param {any} value - The value to filter by (e.g., 'CULINARY', 'ACTIVE')
 * @param {function} setColumnFilters - The parent component's state setter function
 */
export const handleTableFilterChange = (id, value, setColumnFilters) => {
  setColumnFilters((prev) => {
    // Remove any existing filter matching this column ID
    const filtered = prev.filter((item) => item.id !== id);

    // If the value is blank (e.g. "All Statuses"), just return the cleaned list
    if (!value) return filtered;

    // Otherwise, append the new filter object to the array
    return [...filtered, { id, value }];
  });
};

/**
 * Converts the TanStack sorting state array into a single string for API requests.
 * @param {Array<Object>} sorting - The current sorting state from TanStack Table.
 * @returns {string|undefined} - A string like 'name' or '-created_at', or undefined if no sorting is applied.
 */
export function getOrdering(sorting) {
  if (!sorting.length) return undefined;

  const sort = sorting[0];

  return sort.desc ? `-${sort.id}` : sort.id;
}
