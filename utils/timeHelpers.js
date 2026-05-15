// ------------------------------------------------------------------- //
// ----------- Helper functions related to Time and Dates ------------ //
// ------------------------------------------------------------------- //
 
// Get the start and end dates of a given month and year
export const getMonthRange = (year, month) => ({
  monthStart: new Date(year, month - 1, 1),
  monthEnd: new Date(year, month, 0),
});

// Get the difference in hours between two time strings (HH:MM)
export const getHoursDifference = (start, end) => {
  // 1. Validate input
  if (!start || !end || typeof start !== "string" || typeof end !== "string") {
    return 0;
  }

  const startParts = start.split(":");
  const endParts = end.split(":");

  // 2. Validate format
  if (startParts.length !== 2 || endParts.length !== 2) {
    return 0;
  }

  const [sh, sm] = startParts.map(Number);
  const [eh, em] = endParts.map(Number);

  // 3. Validate numbers
  if ([sh, sm, eh, em].some((v) => isNaN(v))) {
    return 0;
  }

  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;

  const diff = endMinutes - startMinutes;

  // 4. Prevent negative values
  return diff > 0 ? diff / 60 : 0;
};

// Transform a time string in 12-hour format (e.g., "02:30 PM") to an object with hours and minutes in 24-hour format
export const normalizeTime = (timeStr) => {
  if (!timeStr) return null;

  const [time, modifier] = timeStr.split(" ");
  let [hours, minutes] = time.split(":").map(Number);

  if (modifier === "PM" && hours !== 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;

  return { h: hours, m: minutes };
};

// Get the week number of the year for a given date 
export const getWeekNumber = (date) => {
  const temp = new Date(date.getTime());
  temp.setHours(0, 0, 0, 0);

  // Set to nearest Thursday (Because the week number is based on the week containing the first Thursday of the year)
  temp.setDate(temp.getDate() + 3 - ((temp.getDay() + 6) % 7));
  
  // January 4th is always in the first week of the year
  const week1 = new Date(temp.getFullYear(), 0, 4);

  // 86400000 = number of ms in a day
  return (
    1 +
    Math.round(((temp - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  );
};

// Return all the days between two dates (Inclusive)
export const getDatesBetween = (start, end) => {
  const dates = [];

  let current = new Date(start);
  current.setHours(0, 0, 0, 0);

  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
};

// Parse a date string and return a Date object, or null if invalid
export const parseDate = (value) => {
  if (!value) return null; // Handles null, undefined, ""

  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
};

// Get the start of today
export const getStartAndEndOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return { start: today, end: tomorrow };
};

