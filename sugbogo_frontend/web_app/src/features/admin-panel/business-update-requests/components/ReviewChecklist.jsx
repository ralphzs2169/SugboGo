import { CircleHelp, ClipboardCheck } from "lucide-react";

/** Renders read-only review guidance supplied by the request type. */
export default function ReviewChecklist({ questions }) {
  return (
    <section className="border-t border-stroke p-5 sm:p-6">
      <div className="flex items-start gap-2">
        <ClipboardCheck
          size={16}
          className="shrink-0 text-text-secondary"
          aria-hidden="true"
        />
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
            Review Checklist
          </h3>
          <p className="mt-2 text-xs leading-5 text-text-secondary">
            Consider the following before making a decision.
          </p>
        </div>
      </div>

      <ul className="mt-5">
        {questions.map((question) => (
          <li
            key={question}
            className="flex items-start gap-3 border-b border-stroke/70 py-3 first:pt-0 last:border-b-0 last:pb-0"
          >
            <CircleHelp
              size={16}
              className="mt-0.5 shrink-0 text-text-secondary"
              aria-hidden="true"
            />
            <span className="text-sm font-medium leading-6 text-text-primary">
              {question}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
