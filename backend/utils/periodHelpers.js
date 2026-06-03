// Get a human-readable label for the period based on the filter type and parameters
export const getPeriodLabel = ({ type, year, month, trimester, startDate, endDate }) => {
  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  if (type === "month") return `${months[month - 1]}_${year}`;
  if (type === "trimester") return `Trimester${trimester}_${year}`;
  if (type === "year") return `${year}`;

  if (type === "custom") {
    const format = (d) => new Date(d).toISOString().split("T")[0]; // Format as YYYY-MM-DD
    return `${format(startDate)}_to_${format(endDate)}`; // e.g., "2024-01-01_to_2024-03-31"
  }

  return "period";
};

export const getPeriodTypeName = (periodType) => {
  switch (periodType) {
    case "day":
      return "daily";
    case "month":
      return "monthly";
    case "trimester":
      return "trimester";
    case "year":
      return "yearly";
    case "custom":
      return "custom";
    default:
      return periodType;
  }
};

export const getStatsPeriodLabel = ({
  periodType,
  month,
  trimester,
  year,
  startDate,
  endDate,
}) => {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  if (periodType === "day") return `${startDate}`;
  if (periodType === "month") return `${months[month - 1]}_${year}`;
  if (periodType === "trimester") return `T${trimester}_${year}`;
  if (periodType === "year") return `${year}`;

  if (periodType === "custom") {
    const format = (d) => new Date(d).toISOString().split("T")[0]; // Format as YYYY-MM-DD
    return `${format(startDate)}_to_${format(endDate)}`; // e.g., "2024-01-01_to_2024-03-31"
  }

  return "period";
};
