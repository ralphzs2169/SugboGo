import { ChevronDown } from "lucide-react";
/**
 * A pill-shaped filter select with active-state styling, used for the
 * toolbar-level filters above the table. Clearing an individual filter
 * happens by re-selecting the placeholder, or via the page-level
 * "Clear filters" action.
 */
export default function FilterPill({
  icon: Icon,
  placeholder,
  options,
  value,
  onChange,
}) {
  const isActive = Boolean(value);

  return (
    <div className="relative flex items-center">
      <Icon
        className={`pointer-events-none absolute left-3.5 h-3.5 w-3.5 transition-colors ${
          isActive ? "text-text-primary" : "text-text-secondary"
        }`}
      />

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={placeholder}
        className={`h-9 cursor-pointer appearance-none rounded-full border py-2 pl-9 pr-8 text-sm font-medium outline-none transition-colors ${
          isActive
            ? "border-stroke-active bg-surface-muted text-text-primary hover:bg-interaction-hover"
            : "border-stroke-strong bg-background text-text-primary hover:bg-interaction-hover"
        } focus:border-stroke-active focus:ring-2 focus:ring-stroke-active/10`}
      >
        <option value="">{placeholder}</option>

        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <ChevronDown
        className={`pointer-events-none absolute right-3 h-3.5 w-3.5 transition-colors ${
          isActive ? "text-text-primary" : "text-text-secondary"
        }`}
        strokeWidth={2}
      />
    </div>
  );
}
