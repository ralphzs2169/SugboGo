import { PREVIEW_STATES, useNotificationPreview } from "./notificationPreview";

/** Select development fixtures for the real bell, dropdown, and history components. */
export default function NotificationPreviewToggle() {
  const { scenario, setScenario } = useNotificationPreview();
  return (
    <label className="flex flex-col gap-1 text-[11px] text-text-secondary">
      Notification preview
      <select
        aria-label="Notification preview state"
        value={scenario}
        onChange={(event) => setScenario(event.target.value)}
        className="max-w-36 rounded-md border border-stroke bg-background px-2 py-1 text-xs text-text-primary focus-visible:outline-2 focus-visible:outline-info"
      >
        {PREVIEW_STATES.map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
    </label>
  );
}
