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
      <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
        {title}
      </h1>
    </div>
  );
}
