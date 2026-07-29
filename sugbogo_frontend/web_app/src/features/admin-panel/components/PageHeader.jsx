import Breadcrumbs from "./Breadcrumbs";

export default function PageHeader({ title, description, breadcrumbs = [] }) {
  return (
    <div className="mb-4 ">
      {breadcrumbs.length > 0 && (
        <div className="mb-2">
          <Breadcrumbs items={breadcrumbs} />
        </div>
      )}

      <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
        {title}
      </h1>
    </div>
  );
}
