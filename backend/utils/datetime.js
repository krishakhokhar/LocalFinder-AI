/**
 * Formats an instant in a specific local timezone.
 *
 * Notification text is read by a person in a particular place, so it has
 * to say the time *they* will turn up, not the server's UTC clock. The
 * offset travels with the booking for exactly this reason.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatDateTime(date, tzOffsetMinutes = 0) {
  const local = new Date(new Date(date).getTime() + tzOffsetMinutes * 60 * 1000);

  const weekday = DAYS[local.getUTCDay()];
  const day = local.getUTCDate();
  const month = MONTHS[local.getUTCMonth()];

  const hours24 = local.getUTCHours();
  const minutes = String(local.getUTCMinutes()).padStart(2, "0");
  const period = hours24 >= 12 ? "pm" : "am";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

  return `${weekday} ${day} ${month}, ${hours12}:${minutes} ${period}`;
}

export function formatDate(date, tzOffsetMinutes = 0) {
  const local = new Date(new Date(date).getTime() + tzOffsetMinutes * 60 * 1000);
  return `${DAYS[local.getUTCDay()]} ${local.getUTCDate()} ${MONTHS[local.getUTCMonth()]}`;
}

/** "YYYY-MM-DD" for a given instant in a given timezone. */
export function localDateString(date, tzOffsetMinutes = 0) {
  return new Date(new Date(date).getTime() + tzOffsetMinutes * 60 * 1000).toISOString().slice(0, 10);
}
