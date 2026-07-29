import TextInput from "@/shared/components/forms/TextInput";
import TextArea from "@/shared/components/forms/TextArea";
import Button from "@/shared/components/Button";
import SelectInput from "@/shared/components/forms/SelectInput";

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

      <SelectInput
        id="cluster_id"
        name="cluster_id"
        label="Cluster"
        value={values.cluster_id}
        onChange={onChange}
        error={errors.cluster_id}
        required
        disabled={isLoadingClusters}
        placeholder={
          isLoadingClusters ? "Loading clusters..." : "Select a cluster"
        }
      >
        {clusters?.map((cluster) => (
          <option key={cluster.id} value={cluster.id}>
            {cluster.name}
          </option>
        ))}
      </SelectInput>

      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
