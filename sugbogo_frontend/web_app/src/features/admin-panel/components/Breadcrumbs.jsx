import { ChevronRight } from "lucide-react";

export default function Breadcrumbs({ items = [] }) {
  return (
    <nav className="mb-3 flex items-center gap-2 text-sm">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <div key={item.label} className="flex items-center gap-2">
            <span
              className={
                isLast ? "font-medium text-text-primary" : "text-text-secondary"
              }
            >
              {item.label}
            </span>

            {!isLast && (
              <ChevronRight className="h-4 w-4 text-text-secondary" />
            )}
          </div>
        );
      })}
    </nav>
  );
}
