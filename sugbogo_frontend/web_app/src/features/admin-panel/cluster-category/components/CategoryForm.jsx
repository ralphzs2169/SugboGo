import TextInput from "@/shared/components/forms/TextInput";
import TextArea from "@/shared/components/forms/TextArea";
import Button from "@/shared/components/Button";
import SelectInput from "@/shared/components/forms/SelectInput";

/**
 * Reusable form for creating and editing categories.
 *
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
  submitDisabled = false,
  onClearError,
}) {
  function handleChange(event) {
    onChange(event);
    onClearError?.(event.target.name);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <TextInput
        id="name"
        name="name"
        label="Category Name"
        placeholder="Enter category name"
        value={values.name}
        onChange={handleChange}
        error={errors.name}
        required
      />

      <TextArea
        id="description"
        name="description"
        label="Description"
        placeholder="Enter category description"
        value={values.description}
        onChange={handleChange}
        error={errors.description}
        rows={4}
      />

      <SelectInput
        id="cluster_id"
        name="cluster_id"
        label="Cluster"
        value={values.cluster_id}
        onChange={handleChange}
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
        <Button
          type="submit"
          loading={isSubmitting}
          disabled={submitDisabled}
          disabledTooltip="Make a change before saving."
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
