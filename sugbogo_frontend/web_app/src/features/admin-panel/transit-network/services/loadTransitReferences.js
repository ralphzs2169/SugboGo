export const TRANSIT_REFERENCE_PAGE_SIZE = 100;

/** Collect every API page, publishing nothing until the complete set is consistent. */
export async function loadTransitReferences(fetchPage, { signal } = {}) {
  const items = [];
  const ids = new Set();
  let snapshot;

  for (let page = 1; ; page += 1) {
    signal?.throwIfAborted();
    const result = await fetchPage(
      { page, page_size: TRANSIT_REFERENCE_PAGE_SIZE },
      { signal },
    );
    signal?.throwIfAborted();
    const meta = result?.pagination;
    const expectedLength = meta
      ? Math.min(meta.page_size, Math.max(0, meta.total_items - (page - 1) * meta.page_size))
      : null;
    if (
      !Array.isArray(result?.items) || !meta || meta.page !== page ||
      !Number.isSafeInteger(meta.page_size) || meta.page_size < 1 ||
      meta.page_size > TRANSIT_REFERENCE_PAGE_SIZE ||
      !Number.isSafeInteger(meta.total_items) || meta.total_items < 0 ||
      !Number.isSafeInteger(meta.total_pages) || meta.total_pages < 0 ||
      meta.total_pages !== Math.ceil(meta.total_items / meta.page_size) ||
      page > Math.max(1, meta.total_pages) ||
      meta.has_next !== (page < meta.total_pages) ||
      result.items.length !== expectedLength
    ) {
      throw new Error("Unable to load the complete transit reference list. Retry loading the list.");
    }
    const currentSnapshot = `${meta.total_items}:${meta.total_pages}:${meta.page_size}`;
    if (snapshot !== undefined && snapshot !== currentSnapshot) {
      throw new Error("Transit references changed while loading. Retry to load the current list.");
    }
    snapshot = currentSnapshot;

    for (const item of result.items) {
      if (item?.id == null || ids.has(String(item.id))) {
        throw new Error("Transit references changed or contain duplicate IDs. Retry loading the list.");
      }
      ids.add(String(item.id));
      items.push(item);
    }
    if (!meta.has_next) return items;
  }
}
