// Utility function to normalize task status values
export const normalizeStatus = (status) => {
  if (!status) return status;
  
  const s = status.toLowerCase().replace(/[_-]/g, " ");
  if (s === "backlog") return "Backlog";
  if (s === "todo" || s === "to do") return "To Do";
  if (s === "in progress") return "In Progress";
  if (s === "review") return "Review";
  if (s === "done") return "Done";
  
  return status;
};
