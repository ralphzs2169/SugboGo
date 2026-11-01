export const activitySeries = [
  {
    key: "applications_submitted",
    label: "Applications submitted",
    color: "var(--color-primary)",
    dash: undefined,
  },
  {
    key: "reviews_published",
    label: "Reviews published",
    color: "var(--color-info)",
    dash: "6 4",
  },
  {
    key: "vouches_created",
    label: "Vouches created",
    color: "var(--color-success)",
    dash: "2 3",
  },
];

/** Accept only seven consecutive server dates with real counts; never pad unavailable series with zeros. */
export function platformActivityDays(activity) {
  const rows = activity?.daily;
  if (!Array.isArray(rows) || rows.length !== 7) return null;
  const valid = rows.every((row, index) => {
    if (!row || typeof row.date !== "string") return false;
    const time = Date.parse(`${row.date}T00:00:00Z`);
    return (
      /^\d{4}-\d{2}-\d{2}$/.test(row.date) &&
      Number.isFinite(time) &&
      new Date(time).toISOString().slice(0, 10) === row.date &&
      (index === 0 ||
        time - Date.parse(`${rows[index - 1].date}T00:00:00Z`) === 86400000) &&
      activitySeries.every(
        ({ key }) => Number.isInteger(row[key]) && row[key] >= 0,
      )
    );
  });
  return valid ? rows : null;
}
