import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ExternalLink,
  MapPin,
  LockKeyhole,
  ChevronDown,
  ImageOff,
} from "lucide-react";
import Button from "@/shared/components/Button";
import TextArea from "@/shared/components/forms/TextArea";
import StatusBadge from "@/shared/components/StatusBadge";
import { MIN_FEEDBACK_LENGTH } from "../../config/rejectionFeedback.config";
import { CLUSTER_ICONS } from "../../../cluster-category/constants/clusterIcons";
import ApplicationReviewSection from "./ApplicationReviewSection";
import {
  getDuplicateReviewStatus,
  assessmentDecisions,
  selectedAssessmentDecision,
} from "../../utils/applicationDecision.utils";
import {
  duplicateAssessmentTemplates,
  appendAssessmentTemplate,
} from "../../config/duplicateAssessmentTemplates";

/** Show a real storefront cover or a neutral fallback when none is available. */
function CandidateCover({ url, name }) {
  const [failed, setFailed] = useState(false);
  return url && !failed ? (
    <img
      src={url}
      alt={`${name} storefront`}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-14 w-14 shrink-0 rounded-lg object-cover"
    />
  ) : (
    <div
      role="img"
      aria-label="No cover photo available"
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-text-secondary"
    >
      <ImageOff size={20} aria-hidden="true" />
    </div>
  );
}

const DECISIONS = assessmentDecisions;

/** Presents a compact, responsive candidate card while retaining drafts when collapsed or refreshed. */
function CandidateAssessment({
  candidate,
  submissionId,
  mutation,
  editable,
  checking,
  collapsible,
  initiallyExpanded,
}) {
  const [decision, setDecision] = useState(
    selectedAssessmentDecision(candidate.assessment?.decision),
  );
  const [explanation, setExplanation] = useState(
    candidate.assessment?.explanation || "",
  );
  const dirty =
    decision !== selectedAssessmentDecision(candidate.assessment?.decision) ||
    explanation !== (candidate.assessment?.explanation || "");
  const disabled = !editable || mutation.isPending || checking;
  const id = `duplicate-${candidate.key.replace(":", "-")}`;
  const href =
    candidate.record_type === "business"
      ? `/admin-panel/businesses/${candidate.record_id}`
      : `/admin-panel/business/application/${candidate.record_id}`;
  const badge = candidate.stale
    ? "Stale evidence"
    : dirty
      ? "Unsaved changes"
      : selectedAssessmentDecision(candidate.assessment?.decision)
        ? "Saved"
        : "Needs Review";
  const ClusterIcon = CLUSTER_ICONS.find(
    (item) => item.value === candidate.cluster_icon,
  )?.icon;
  const statusVariant =
    candidate.status === "active"
      ? "successSoft"
      : candidate.status === "suspended"
        ? "warningSoft"
        : "mutedSoft";

  useEffect(() => {
    if (!dirty || !editable) return;
    function preventDraftLoss(event) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", preventDraftLoss);
    return () => window.removeEventListener("beforeunload", preventDraftLoss);
  }, [dirty, editable]);

  const content = (
    <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-2 lg:gap-6">
      {/* Matching identity and evidence */}
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-text-secondary">
            Matching{" "}
            {candidate.record_type === "business" ? "business" : "application"}
          </h3>
          <StatusBadge variant={statusVariant}>
            <span className="capitalize">{candidate.status}</span>
          </StatusBadge>
        </div>
        <div className="flex items-center gap-3">
          <CandidateCover
            key={candidate.cover_photo_url || "no-cover"}
            url={candidate.cover_photo_url}
            name={candidate.business_name}
          />
          <div className="min-w-0">
            <h4 className="break-words text-lg font-bold leading-snug text-text-primary">
              <Link
                to={href}
                target="_blank"
                rel="noreferrer"
                className="group inline-flex items-center gap-1.5 rounded-sm transition-colors hover:text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                title={candidate.business_name}
              >
                <span className="break-words">{candidate.business_name}</span>
                <ExternalLink
                  className="h-3.5 w-3.5 shrink-0 text-text-secondary transition-colors group-hover:text-primary"
                  aria-hidden="true"
                />
              </Link>
            </h4>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-text-secondary">
              {ClusterIcon && (
                <ClusterIcon
                  size={16}
                  className="shrink-0"
                  aria-hidden="true"
                />
              )}
              {candidate.category_name || "Classification unavailable"}
            </p>
          </div>
        </div>
        <p className="text-sm leading-6 text-text-secondary">
          {candidate.address}
        </p>
        <div className="space-y-2">
          {candidate.distance_metres != null && (
            <p className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
              <MapPin size={15} aria-hidden="true" />
              {candidate.distance_metres} metres away
            </p>
          )}
          <ul className="flex flex-wrap gap-2" aria-label="Matching evidence">
            {candidate.reasons.map((reason) => (
              <li
                key={reason}
                className="rounded-md bg-surface-muted px-2.5 py-1 text-sm text-text-secondary"
              >
                {reason === "exact_name_and_address"
                  ? "Exact name + complete address"
                  : "Exact name + nearby location"}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {/* Assessment, explanation and save state stay together */}
      <div
        className="min-w-0 space-y-3 border-t border-stroke pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0"
        aria-busy={mutation.isPending || checking}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-text-primary">
            Your assessment
          </h3>
          <span
            role="status"
            className={`text-sm font-medium ${candidate.stale ? "text-danger" : dirty ? "text-warning" : candidate.assessment ? "text-success" : "text-text-secondary"}`}
          >
            {mutation.isPending &&
            mutation.variables?.candidate_key === candidate.key
              ? "Saving assessment..."
              : checking
                ? "Checking evidence..."
                : badge}
          </span>
        </div>
        <fieldset disabled={disabled}>
          <legend className="sr-only">
            Assessment for {candidate.business_name}
          </legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {DECISIONS.map(([value, label]) => (
              <label
                key={value}
                className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-1.5 py-2 text-sm leading-5 text-text-primary hover:bg-surface-muted has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-stroke-active/30"
              >
                <input
                  type="radio"
                  name={id}
                  value={value}
                  checked={decision === value}
                  onChange={() => setDecision(value)}
                  className="h-4 w-4 shrink-0 appearance-none rounded-full border-2 border-stroke-strong bg-background checked:border-primary checked:bg-primary checked:shadow-[inset_0_0_0_3px_var(--color-background)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <TextArea
          id={`${id}-explanation`}
          label="Internal explanation"
          minLength={decision ? MIN_FEEDBACK_LENGTH : undefined}
          showCharacterCount
          characterCountMode="minimum"
          beforeInput={
            editable && (
              <div
                className="mb-3 flex flex-wrap gap-2"
                aria-label="Quick assessment notes"
              >
                {(duplicateAssessmentTemplates[decision] || []).map(
                  ([label, template]) => (
                    <button
                      key={label}
                      type="button"
                      disabled={
                        disabled ||
                        appendAssessmentTemplate(explanation, template) ===
                          explanation
                      }
                      onClick={() =>
                        setExplanation((current) =>
                          appendAssessmentTemplate(current, template),
                        )
                      }
                      className="cursor-pointer rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary ring-1 ring-inset ring-stroke transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {label}
                    </button>
                  ),
                )}
              </div>
            )
          }
          placeholder="Explain your assessment..."
          rows={3}
          value={explanation}
          onChange={(event) => setExplanation(event.target.value)}
          disabled={disabled}
          maxLength={4000}
          required={!!decision}
        />
        {candidate.stale && (
          <p className="text-sm text-danger">
            Evidence changed. Review and save a new assessment.
          </p>
        )}
        {candidate.assessment && (
          <p className="text-sm text-text-secondary">
            Saved assessment:{" "}
            {DECISIONS.find(
              ([value]) => value === candidate.assessment.decision,
            )?.[1] || "Unresolved (previous assessment)"}
            .
            {candidate.assessment.reviewed_at &&
              ` Reviewed ${new Date(candidate.assessment.reviewed_at).toLocaleString()}.`}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text-secondary">
            Internal only; this does not reject the application.
          </p>
          {editable && (
            <Button
              size="sm"
              className="ml-auto shrink-0"
              loading={
                mutation.isPending &&
                mutation.variables?.candidate_key === candidate.key
              }
              disabled={
                disabled ||
                !decision ||
                explanation.trim().length < MIN_FEEDBACK_LENGTH ||
                (!!candidate.assessment && !dirty && !candidate.stale)
              }
              onClick={() =>
                mutation.mutate({
                  action: "assess",
                  submission_id: submissionId,
                  candidate_key: candidate.key,
                  fingerprint: candidate.fingerprint,
                  decision,
                  explanation,
                })
              }
            >
              Save Assessment
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  if (collapsible)
    return (
      <details
        open={initiallyExpanded}
        className="group rounded-lg border border-stroke bg-surface"
      >
        <summary className="flex min-h-12 cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm focus-visible:outline sm:px-5 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 break-words font-semibold text-text-primary">
            {candidate.business_name}
          </span>
          <span className="flex items-center gap-2 text-text-secondary">
            {badge}
            <ChevronDown
              size={16}
              className="transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </span>
        </summary>
        {content}
      </details>
    );
  return (
    <article className="rounded-lg border border-stroke bg-surface">
      {content}
    </article>
  );
}

/** Displays live matches and records assessments independently of final rejection. */
export default function PossibleDuplicatesReview({
  application,
  query,
  mutation,
}) {
  const state = query.data;
  const disposition = state?.disposition;

  const summary = getDuplicateReviewStatus(
    query,
    application.latest_submission_id,
  );
  const hasCurrentCandidates =
    Array.isArray(state?.candidates) &&
    state.submission_id === application.latest_submission_id &&
    state.candidates.length > 0;
  const outstandingCount =
    state?.candidates?.filter((candidate) => !candidate.resolved).length || 0;
  const checking = summary.state !== "matches";
  return (
    <>
      {/* Historical rejection remains accessible independently of current matching. */}
      {disposition && (
        <details className="rounded-lg border border-stroke bg-surface p-4">
          <summary className="cursor-pointer text-sm font-semibold text-text-primary">
            Recorded duplicate rejection
          </summary>
          <p className="mt-3 whitespace-pre-wrap text-sm">
            {disposition.explanation}
          </p>
          {disposition.reconsidered && (
            <p className="mt-2 text-sm text-text-secondary">
              Historical reconsideration:{" "}
              {disposition.reconsideration_explanation}. Resubmission no longer
              requires administrator clearance.
            </p>
          )}
        </details>
      )}
      {summary.state !== "empty" && !hasCurrentCandidates && (
        <div
          role={summary.state === "error" ? "alert" : "status"}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stroke bg-surface p-4 text-sm"
        >
          <p>{summary.message}</p>
          {["error", "unavailable", "stale_submission"].includes(
            summary.state,
          ) && (
            <Button variant="secondary" onClick={() => query.refetch()}>
              Try Again
            </Button>
          )}
        </div>
      )}
      {hasCurrentCandidates && (
        <ApplicationReviewSection
          icon={AlertTriangle}
          title="Duplicate Review"
          description="Investigate potentially matching businesses."
          headerAction={
            <StatusBadge
              variant={outstandingCount ? "warningSoft" : "successSoft"}
            >
              {outstandingCount
                ? `${outstandingCount} needs review`
                : "All assessed"}
            </StatusBadge>
          }
        >
          <div className="space-y-3">
            {state.candidates.map((candidate, index) => (
              <CandidateAssessment
                key={`${state.submission_id}-${candidate.key}-${candidate.fingerprint}`}
                candidate={candidate}
                submissionId={state.submission_id}
                mutation={mutation}
                editable={application.status === "submitted"}
                checking={checking}
                collapsible={state.candidates.length > 1}
                initiallyExpanded={index === 0}
              />
            ))}
          </div>
          {/* One section-level explanation of current approval availability. */}
          <div
            role={query.isError ? "alert" : "status"}
            className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stroke pt-4 text-sm text-text-secondary"
          >
            <p className="flex items-center gap-2">
              <LockKeyhole size={15} className="shrink-0" aria-hidden="true" />
              {checking
                ? summary.message
                : state.approval_blocked
                  ? "Approval blocked until outstanding matches are resolved."
                  : "All current matches have valid legitimate-business assessments."}
            </p>
            {query.isError && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => query.refetch()}
              >
                Try Again
              </Button>
            )}
          </div>
        </ApplicationReviewSection>
      )}
    </>
  );
}
