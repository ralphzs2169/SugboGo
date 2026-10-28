import { useId } from "react";
import SelectInput from "@/shared/components/forms/SelectInput";

/** Uses the existing labelled Admin select for a report's supported metric choices. */
export default function AnalyticsMetricSelector({ label = "Metric", value, onChange, options, disabled = false }) {
  const id = useId();
  return (
    <div className="w-full min-w-0 sm:w-auto sm:min-w-40">
      {/* Native keyboard-accessible metric selection */}
      <SelectInput
        id={id}
        label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={null}
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </SelectInput>
    </div>
  );
}
