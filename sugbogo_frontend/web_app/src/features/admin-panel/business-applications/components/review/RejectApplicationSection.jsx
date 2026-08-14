import TextArea from "@/shared/components/forms/TextArea";

/**
 * Renders one rejection feedback section inside the application rejection
 * drawer. It provides section selection, quick-reason templates, editable
 * feedback, validation feedback, and character-count guidance.
 */
export default function RejectApplicationSection({
  section,
  isSelected,
  fieldError,
  fieldValue,
  minFeedbackLength,
  onSectionToggle,
  onFeedbackChange,
  onTemplateClick,
}) {
  const checkboxId = `section-${section.value}`;
  const textareaId = `feedback-${section.value}`;

  return (
    <div className="rounded-lg border p-4 transition-colors border-stroke">
      {/* Section selection */}
      <label
        htmlFor={checkboxId}
        className="flex cursor-pointer items-start gap-3"
      >
        <input
          id={checkboxId}
          type="checkbox"
          checked={isSelected}
          onChange={() => onSectionToggle(section.value)}
          className="mt-0.5 h-4 w-4 cursor-pointer rounded border-stroke-strong text-primary focus:ring-primary/20"
        />

        <span className="text-sm font-medium text-text-primary">
          {section.label}
        </span>
      </label>

      {/* Section feedback */}
      <div
        className={`grid transition-all duration-200 ease-out ${
          isSelected
            ? "mt-3 grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="pl-7">
            {/* Quick-reason templates */}
            <div className="mb-4 flex flex-wrap gap-2">
              {section.templates.map((template) => (
                <button
                  key={template}
                  type="button"
                  onClick={() => onTemplateClick(section.value, template)}
                  className="cursor-pointer rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary shadow-sm ring-1 ring-inset ring-stroke transition-all hover:bg-surface-hover hover:text-text-primary hover:ring-stroke-strong"
                >
                  {template}
                </button>
              ))}
            </div>

            <TextArea
              id={textareaId}
              name={section.value}
              label="What needs to change"
              placeholder={`Describe what needs to be changed in ${section.label.toLowerCase()}, or pick a quick reason above...`}
              value={fieldValue}
              onChange={(event) =>
                onFeedbackChange(section.value, event.target.value)
              }
              error={fieldError}
              rows={3}
              minLength={minFeedbackLength}
              showCharacterCount
            />
          </div>
        </div>
      </div>
    </div>
  );
}
