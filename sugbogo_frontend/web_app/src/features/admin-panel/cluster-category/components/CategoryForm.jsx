import TextInput from "@/shared/components/forms/TextInput";
import TextArea from "@/shared/components/forms/TextArea";
import Button from "@/shared/components/Button";

/**
 * Reusable form for creating and editing categories.
 *
 * @param {Object} props
 * @param {Object} props.values - Current form values.
 * @param {Object} props.errors - Validation errors keyed by field.
 * @param {Array} props.clusters - Available clusters.
 * @param {boolean} props.isLoadingClusters - Whether clusters are loading.
 * @param {Function} props.onChange - Input change handler.
 * @param {Function} props.onSubmit - Form submit handler.
 * @param {boolean} props.isSubmitting - Whether form is submitting.
 *
 * @returns {JSX.Element}
 */
export default function CategoryForm({
  values,
  errors,
  clusters,
  isLoadingClusters,
  onChange,
  onSubmit,
  isSubmitting,
  submitLabel = "Save Category",
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <TextInput
        id="name"
        name="name"
        label="Category Name"
        placeholder="Enter category name"
        value={values.name}
        onChange={onChange}
        error={errors.name}
        required
      />

      <TextArea
        id="description"
        name="description"
        label="Description"
        placeholder="Enter category description"
        value={values.description}
        onChange={onChange}
        error={errors.description}
        rows={4}
      />

      <div>
        <label
          htmlFor="cluster_id"
          className="mb-2 block text-sm font-medium text-text-primary"
        >
          Cluster
          <span className="ml-1 text-danger">*</span>
        </label>

        <select
          id="cluster_id"
          name="cluster_id"
          value={values.cluster_id}
          onChange={onChange}
          className={`w-full rounded-lg bg-background-primary px-3 py-2.5 text-sm text-text-primary outline-none transition ${
            errors.cluster_id
              ? "border border-danger focus:border-danger focus:ring-4 focus:ring-danger/15"
              : "border border-stroke focus:border-primary focus:ring-4 focus:ring-primary/15"
          }`}
        >
          <option value="">
            {isLoadingClusters ? "Loading clusters..." : "Select a cluster"}
          </option>

          {clusters?.map((cluster) => (
            <option key={cluster.id} value={cluster.id}>
              {cluster.name}
            </option>
          ))}
        </select>

        {errors.cluster_id && (
          <p className="mt-1 text-sm text-danger">{errors.cluster_id}</p>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
