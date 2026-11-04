import { List } from "lucide-react";
import SortMenu from "./SortMenu";

/** Uses the existing flyout's keyboard navigation and focus recovery. */
export default function RowsPerPageMenu({
  value,
  onChange,
  ariaLabel = "Rows per page",
}) {
  const sizes = [...new Set([10, 25, 50, 100, value])].sort(
    (first, second) => first - second,
  );

  return (
    <SortMenu
      value={value}
      options={sizes.map((size) => ({ value: size, label: String(size) }))}
      onChange={onChange}
      ariaLabel={ariaLabel}
      triggerLabel={`Rows: ${value}`}
      icon={List}
    />
  );
}
