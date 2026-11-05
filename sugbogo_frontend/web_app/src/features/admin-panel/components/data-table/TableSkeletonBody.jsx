import SkeletonCell from "./SkeletonCell";

/**
 * Skeleton body shown while the table is performing its initial load.
 *
 * @param {Object} props
 * @param {Array} props.columns
 * @param {number} [props.rowCount=8]
 */
export default function TableSkeletonBody({ columns, rowCount = 8 }) {
  return (
    <tbody>
      {Array.from({ length: rowCount }).map((_, rowIndex) => (
        <tr
          key={rowIndex}
          className="border-b border-stroke last:border-b-0 bg-background"
        >
          {columns.map((column) => (
            <td key={column.id} className="px-4 py-4">
              <div className={
                column.columnDef.meta?.align === "right"
                  ? "flex justify-end"
                  : column.columnDef.meta?.align === "center"
                    ? "flex justify-center"
                    : undefined
              }>
                <SkeletonCell type={column.columnDef.meta?.skeleton} />
              </div>
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
