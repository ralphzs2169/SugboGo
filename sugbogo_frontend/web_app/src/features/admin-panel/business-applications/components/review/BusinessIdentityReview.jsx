import ApplicationReviewField from "./ApplicationReviewField";
import ApplicationReviewSection from "./ApplicationReviewSection";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import ApplicationReviewFeedback from "./ApplicationReviewFeedback";
import { Store } from "lucide-react";

const representativeRoleLabels = {
  owner: "Owner",
  manager: "Manager",
  authorized_representative: "Authorized Representative",
  other: "Other",
};

/**
 * Displays the business identity information submitted by the merchant.
 *
 * Groups business details, representative information, classification,
 * and specialty tags into a single reviewable section.
 */
export default function BusinessIdentityReview({
  identity,
  feedback,
  isResubmission,
}) {
  if (!identity) {
    return (
      <ApplicationReviewSection title="Business Identity">
        <p className="text-sm text-text-secondary">
          No business identity information was submitted.
        </p>
      </ApplicationReviewSection>
    );
  }

  return (
    <ApplicationReviewSection
      icon={Store}
      title="Business Identity"
      description="Review the business information and classification submitted by the merchant."
    >
      <ApplicationReviewFeedback
        feedback={feedback}
        isResubmission={isResubmission}
      />

      {/* Business information */}
      <dl className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
        <ApplicationReviewField
          label="Business Name"
          value={identity.business_name}
          className="md:col-span-2"
          isBusinessName={true}
        />

        <ApplicationReviewField
          label="Business Description"
          value={identity.business_description}
          className="md:col-span-2"
        />

        <ApplicationReviewField
          label="Contact Number"
          value={identity.contact_number}
        />

        <ApplicationReviewField
          label="Business Email"
          value={identity.business_email}
        />

        <ApplicationReviewField label="Website" value={identity.website} />
      </dl>

      {/* Representative information */}
      <div className="mt-8 border-t border-stroke pt-6">
        <h3 className="text-sm font-semibold text-text-primary">
          Representative
        </h3>

        <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
          <ApplicationReviewField
            label="Representative Name"
            value={identity.representative_name}
          />

          <ApplicationReviewField
            label="Representative Role"
            value={
              representativeRoleLabels[identity.representative_role] ??
              identity.representative_role ??
              "—"
            }
          />
        </dl>
      </div>

      {/* Business classification */}
      <div className="mt-8 border-t border-stroke pt-6">
        <h3 className="text-sm font-semibold text-text-primary">
          Business Classification
        </h3>

        <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
          <ApplicationReviewField
            label="Cluster"
            value={identity.business_cluster_name}
          />

          <ApplicationReviewField
            label="Category"
            value={identity.business_category_name}
          />
        </dl>

        <div className="mt-6">
          <dt className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            Specialty Tags
          </dt>

          <div className="mt-2 flex flex-wrap gap-2">
            {identity.specialty_tags?.length ? (
              identity.specialty_tags.map((tag) => (
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
    </ApplicationReviewSection>
  );
}
