import Breadcrumbs from "./Breadcrumbs";

/**
 * Displays a consistent Admin page heading.
 *
 * Supports optional navigation between the breadcrumbs and title
 * without changing the layout of standard Admin pages.
 */
export default function PageHeader({
  title,
  description,
  breadcrumbs = [],
  backAction,
  actions,
}) {
  return (
    <div className="mb-4">
      {/* Breadcrumb navigation */}
      {breadcrumbs.length > 0 && (
        <div className="mb-6">
          <Breadcrumbs items={breadcrumbs} />
        </div>
      )}

      {/* Optional back navigation */}
      {backAction && <div className="mb-4">{backAction}</div>}

      {/* Page heading */}
      {actions ? (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <h1 className="min-w-0 text-2xl font-semibold tracking-tight text-text-primary">
            {title}
          </h1>
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            {actions}
          </div>
        </div>
      ) : (
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
          {title}
        </h1>
      )}
    </div>
  );
}
