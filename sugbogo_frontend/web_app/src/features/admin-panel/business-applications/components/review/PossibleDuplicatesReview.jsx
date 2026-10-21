import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import Button from "@/shared/components/Button";
import TextArea from "@/shared/components/forms/TextArea";
import ApplicationReviewSection from "./ApplicationReviewSection";

const DECISIONS = [
  ["unresolved", "Unresolved"],
  ["confirmed_duplicate", "Confirmed duplicate"],
  ["legitimate", "Legitimate separate business / branch"],
  ["ownership_conflict", "Ownership conflict — investigation required"],
];

/** Edits one candidate independently; the backend validates its evidence before saving. */
function CandidateAssessment({ candidate, submissionId, mutation, editable }) {
  const [decision, setDecision] = useState(
    candidate.assessment?.decision || "unresolved",
  );
  const [explanation, setExplanation] = useState(
    candidate.assessment?.explanation || "",
  );
  const id = `duplicate-${candidate.key.replace(":", "-")}`;
  const href =
    candidate.record_type === "business"
      ? `/admin-panel/businesses/${candidate.record_id}`
      : `/admin-panel/business/application/${candidate.record_id}`;
  return (
    <article className="space-y-4 rounded-lg border border-stroke bg-surface p-4">
      {/* Matching record and evidence */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-bold text-text-primary">
          {candidate.business_name}
        </h3>
        <span className="text-sm capitalize text-text-secondary">
          {candidate.status}
        </span>
      </div>
      <p className="text-sm text-text-secondary">{candidate.address}</p>
      <p className="text-sm text-text-secondary">
        {candidate.distance_metres} metres away
      </p>
      <ul className="list-inside list-disc text-sm text-text-secondary">
        {candidate.reasons.map((reason) => (
          <li key={reason}>
            {reason === "exact_name_and_address"
              ? "Exact name + matching complete address"
              : "Exact name + nearby location"}
          </li>
        ))}
      </ul>
      <Link
        className="inline-block cursor-pointer text-sm font-semibold text-primary underline focus-visible:outline"
        to={href}
        target="_blank"
        rel="noreferrer"
      >
        View matching{" "}
        {candidate.record_type === "business" ? "business" : "application"}
      </Link>
      {candidate.stale && (
        <p role="status" className="text-sm text-danger">
          Evidence changed. Review and save a new assessment.
        </p>
      )}
      {candidate.resolved && (
        <p className="text-sm text-success">
          Resolved as a legitimate separate business.
        </p>
      )}
      {candidate.assessment && (
        <p className="text-xs text-text-secondary">
          Saved assessment:{" "}
          {
            DECISIONS.find(
              ([value]) => value === candidate.assessment.decision,
            )?.[1]
          }
          .
          {candidate.assessment.reviewed_at &&
            ` Reviewed ${new Date(candidate.assessment.reviewed_at).toLocaleString()}.`}
          {(decision !== candidate.assessment.decision ||
            explanation !== candidate.assessment.explanation) &&
            " Unsaved changes — save to update this assessment."}
        </p>
      )}
      {/* Individual administrator decision */}
      <fieldset
        disabled={!editable || mutation.isPending}
        className="space-y-2"
      >
        <legend className="mb-2 text-sm font-semibold text-text-primary">
          Admin assessment
        </legend>
        {DECISIONS.map(([value, label]) => (
          <label
            key={value}
            className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-text-primary"
          >
            <input
              type="radio"
              name={id}
              value={value}
              checked={decision === value}
              onChange={() => setDecision(value)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <TextArea
        id={`${id}-explanation`}
        label="Internal assessment explanation"
        value={explanation}
        onChange={(event) => setExplanation(event.target.value)}
        disabled={!editable || mutation.isPending}
        maxLength={4000}
        required={decision !== "unresolved"}
      />
      {editable && (
        <Button
          loading={mutation.isPending}
          disabled={decision !== "unresolved" && !explanation.trim()}
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

  return (
    <ApplicationReviewSection
      icon={AlertTriangle}
      title="Possible Duplicates"
      description="Review every possible match. Shared locations and legitimate branches may be allowed after assessment."
    >
      {/* Loading and recovery never imply clearance */}
      {query.isPending && <p role="status">Checking possible matches…</p>}
      {query.isError && (
        <div role="alert" className="space-y-3">
          <p>
            Duplicate review is unavailable. Approval requires a successful
            check.
          </p>
          <Button variant="secondary" onClick={() => query.refetch()}>
            Try Again
          </Button>
        </div>
      )}
      {state && !query.isError && !query.isFetching && (
        <div className="space-y-5">
          <p
            role="status"
            className="text-sm font-semibold text-text-secondary"
          >
            {state.approval_blocked
              ? "Review required — approval blocked until resolved"
              : "No unresolved current duplicate matches"}
          </p>
          {state.candidates.map((candidate) => (
            <CandidateAssessment
              key={`${application.id}-${candidate.key}-${candidate.fingerprint}-${candidate.assessment?.reviewed_at || "new"}`}
              candidate={candidate}
              submissionId={state.submission_id}
              mutation={mutation}
              editable={application.status === "submitted"}
            />
          ))}
          {/* Duplicate dispositions remain separate from section feedback */}
          {disposition && (
            <div className="space-y-3 rounded-lg border border-stroke p-4">
              <h3 className="font-bold">Recorded duplicate rejection</h3>
              <p className="whitespace-pre-wrap text-sm">
                {disposition.explanation}
              </p>
              {disposition.reconsidered && (
                <p className="text-sm">
                  Historical reconsideration:{" "}
                  {disposition.reconsideration_explanation}. Resubmission no
                  longer requires administrator clearance.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </ApplicationReviewSection>
  );
}
