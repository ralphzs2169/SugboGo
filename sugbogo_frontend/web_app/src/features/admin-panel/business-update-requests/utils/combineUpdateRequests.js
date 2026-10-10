const SOURCE_PAGE_SIZE = 100;

const TYPE_LABELS = {
  business_name: "Business Name Change",
  classification: "Classification & Specialties Change",
  location: "Location & Landmarks Change",
};

function compareRequests(left, right) {
  const leftPending = left.status === "pending" ? 0 : 1;
  const rightPending = right.status === "pending" ? 0 : 1;

  if (leftPending !== rightPending) {
    return leftPending - rightPending;
  }

  const submittedDifference =
    new Date(right.submitted_at).getTime() -
    new Date(left.submitted_at).getTime();

  if (submittedDifference !== 0) {
    return submittedDifference;
  }

  return `${left.request_type}:${left.id}`.localeCompare(
    `${right.request_type}:${right.id}`,
  );
}

/** Fetches enough source pages to fill a combined page or search all records. */
export async function fetchSourceRequests(
  fetchPage,
  status,
  page,
  pageSize,
  fetchAll,
) {
  const params = {
    status: status === "all" ? undefined : status,
    page_size: SOURCE_PAGE_SIZE,
  };
  const first = await fetchPage({ ...params, page: 1 });
  const total = first.pagination.total_items;
  const needed = fetchAll ? total : Math.min(total, page * pageSize);
  const lastPage = Math.ceil(needed / SOURCE_PAGE_SIZE);

  if (lastPage <= 1) {
    return { items: first.items, total };
  }

  const remainingPages = await Promise.all(
    Array.from({ length: lastPage - 1 }, (_, index) =>
      fetchPage({ ...params, page: index + 2 }),
    ),
  );

  return {
    items: [first, ...remainingPages].flatMap((result) => result.items),
    total,
  };
}

/** Orders and slices existing request records into one cross-type table page. */
export function combineUpdateRequests(sources, { search, page, pageSize }) {
  const normalizedSearch = search.trim().toLowerCase();
  const items = sources
    .flatMap((source) => source.items)
    .filter((request) => {
      if (!normalizedSearch) {
        return true;
      }

      return [
        request.current_business_name,
        request.business_id,
        request.merchant?.name,
        request.merchant?.email,
        TYPE_LABELS[request.request_type],
      ].some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(normalizedSearch),
      );
    })
    .sort(compareRequests);
  const totalItems = normalizedSearch
    ? items.length
    : sources.reduce((total, source) => total + source.total, 0);

  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    totalItems,
    pageCount: Math.ceil(totalItems / pageSize),
  };
}
