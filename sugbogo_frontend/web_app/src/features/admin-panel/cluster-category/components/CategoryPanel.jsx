import CategoryTable from "./CategoryTable";
import { Plus } from "lucide-react";

export default function CategoryPanel({ selectedCluster }) {
  return (
    <section className="rounded-xl border border-stroke bg-background-primary p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            Categories
          </h2>

          <p className="mt-1 text-sm text-text-secondary">
            Manage categories under clusters.
          </p>
        </div>

        <button
          className="
            inline-flex items-center gap-2
            rounded-lg bg-primary
            px-4 py-2
            text-sm font-semibold text-white
            transition hover:opacity-90
          "
        >
          <Plus className="h-4 w-4" />
          Add Category
        </button>
      </div>

      <div className="mt-6">
        <CategoryTable selectedCluster={selectedCluster} />
      </div>
    </section>
  );
}
