/**
 * Displays the permanent weekly operating schedule for an approved business.
 *
 * Presents each day and its configured operating state in a compact,
 * read-only schedule suitable for the business detail page.
 */
export default function BusinessDetailHours({ operatingHours = [] }) {
  const dayOrder = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  const dayLabels = {
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday",
  };

  const hoursByDay = new Map(operatingHours.map((hours) => [hours.day, hours]));

  function formatTime(time) {
    if (!time) {
      return "—";
    }

    const [hour, minute] = time.split(":");
    const date = new Date();

    date.setHours(Number(hour), Number(minute), 0, 0);

    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function getHoursLabel(hours) {
    if (!hours || !hours.is_open) {
      return "Closed";
    }

    if (hours.is_24_hours) {
      return "Open 24 hours";
    }

    return `${formatTime(hours.open_time)} – ${formatTime(hours.close_time)}`;
  }

  return (
    <section>
      <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-text-secondary">
        Operating Hours
      </h2>

      <div className="rounded-xl border border-stroke bg-background p-5">
        {/* Weekly schedule */}
        <div className="divide-y divide-stroke rounded-lg border border-stroke">
          {dayOrder.map((day) => {
            const hours = hoursByDay.get(day);

            return (
              <div
                key={day}
                className="flex items-center justify-between gap-4 px-4 py-3.5"
              >
                <p className="text-sm font-medium text-text-primary">
                  {dayLabels[day]}
                </p>

                <p
                  className={`text-sm ${
                    hours?.is_open ? "text-text-primary" : "text-text-secondary"
                  }`}
                >
                  {getHoursLabel(hours)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
