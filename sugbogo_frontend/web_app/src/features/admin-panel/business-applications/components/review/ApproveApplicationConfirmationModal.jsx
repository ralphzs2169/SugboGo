import Modal from "@/shared/components/modals/Modal";
import Button from "@/shared/components/Button";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
/**
 * Confirms the administrator's decision to approve a merchant application.
 *
 * Provides a final identity check using the business name, application ID,
 * and storefront photo before the approval action is submitted.
 */
export default function ApproveApplicationConfirmationModal({
  isOpen,
  applicationId,
  identity,
  storefrontPhoto,
  onClose,
  onConfirm,
  loading = false,
}) {
  const businessName = identity?.business_name || "Unnamed Business";
  const clusterName = identity?.business_cluster_name;
  const categoryName = identity?.business_category_name;
  const specialtyTags = identity?.specialty_tags ?? [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Approve "${businessName}"?`}
      description="Please confirm that you have reviewed the submitted information and supporting documents."
    >
      <div className="space-y-5">
        {/* Business identity */}
        <div className="flex items-center gap-3">
          {storefrontPhoto ? (
            <img
              src={storefrontPhoto}
              alt={`${identity?.business_name || "Business"} storefront`}
              className="h-14 w-14 shrink-0 rounded-lg border border-stroke object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-stroke bg-surface text-xs text-text-secondary">
              No photo
            </div>
          )}

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-primary">
              {identity?.business_name || "Unnamed Business"}
            </p>

            <p className="mt-0.5 text-xs text-text-secondary">
              Application #{applicationId}
            </p>
          </div>
        </div>
        {/* Business classification */}
        <div className="border-t border-stroke pt-4">
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs font-medium text-text-secondary">
                Cluster
              </dt>
              <dd className="mt-1 text-sm text-text-primary">
                {clusterName || "—"}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium text-text-secondary">
                Category
              </dt>
              <dd className="mt-1 text-sm text-text-primary">
                {categoryName || "—"}
              </dd>
            </div>
          </dl>

          <div className="mt-4">
            <div className="mt-2 flex flex-wrap gap-2">
              {specialtyTags?.length ? (
                specialtyTags.map((tag) => (
                  <SpecialtyTagChip key={tag.id} tag={tag} />
                ))
              ) : (
                <span className="text-sm text-text-secondary">
                  No specialty tags provided.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Approval notice */}
        <div className="rounded-lg border border-stroke bg-surface p-4">
          <p className="text-sm leading-6 text-text-secondary">
            This application will be approved and the business will become
            eligible to appear on SugboGo.
          </p>

          <p className="mt-3 text-sm leading-6 text-text-secondary">
            Please make sure the submitted information and supporting documents
            have been verified before approving this application.
          </p>
        </div>

        {/* Confirmation actions */}
        <div className="flex justify-end gap-3 border-t border-stroke pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="success"
            onClick={onConfirm}
            loading={loading}
          >
            Approve Application
          </Button>
        </div>
      </div>
    </Modal>
  );
}
