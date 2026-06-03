// Checks the HH:mm format for startTime and endTime fields in Special Shifts
export const isValidTime = (time) => {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
};

// Checks the validity of location
export const isValidLocation = (location) => {
  return ["Remote", "Onsite"].includes(location);
};
