import SortMenu from "./SortMenu";
import RowsPerPageMenu from "./RowsPerPageMenu";

/** Presents only choices already supported by the controlled table. */
export default function TableViewControls({
  table,
  pagination,
  onPaginationChange,
  defaultSortLabel = "Default order",
}) {
  const sortableColumns = table.getAllLeafColumns().filter(
    (column) => column.getCanSort() && typeof column.columnDef.header === "string",
  );
  const sorting = table.getState().sorting ?? [];
  const currentSort = sorting[0];
  const options = [
    { value: "", label: defaultSortLabel },
    ...sortableColumns.flatMap((column) => [
      { value: `${column.id}:asc`, label: `${column.columnDef.header}: ascending` },
      { value: `${column.id}:desc`, label: `${column.columnDef.header}: descending` },
    ]),
  ];

  return (
    <>
      {sortableColumns.length > 0 && table.options.onSortingChange && (
        <SortMenu
          value={currentSort ? `${currentSort.id}:${currentSort.desc ? "desc" : "asc"}` : ""}
          options={options}
          onChange={(value) => {
            if (!value) {
              table.setSorting([]);
              return;
            }
            const option = sortableColumns.find(
              (column) => value === `${column.id}:asc` || value === `${column.id}:desc`,
            );
            table.setSorting([{ id: option.id, desc: value.endsWith(":desc") }]);
          }}
        />
      )}
      <RowsPerPageMenu
        value={pagination.pageSize}
        onChange={(pageSize) => onPaginationChange({ pageIndex: 0, pageSize })}
      />
    </>
  );
}
