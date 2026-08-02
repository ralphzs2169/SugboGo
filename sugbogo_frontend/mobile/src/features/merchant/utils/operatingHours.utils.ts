export function timeStringToDate(time: string) {
  const date = new Date();

  if (!time) {
    date.setHours(8, 0, 0, 0);
    return date;
  }

  const [hours, minutes] = time.split(":").map(Number);

  date.setHours(hours, minutes, 0, 0);

  return date;
}

export function dateToTimeString(date: Date) {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");

  return `${hours}:${minutes}`;
}

export function formatTime(time: string) {
  if (!time) {
    return "Select time";
  }

  const [hours, minutes] = time.split(":").map(Number);

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}
