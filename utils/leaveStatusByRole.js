// Utility function to get relevant leave request statuses based on user role
export const getStatusesByRole = (role) => {
  const normalizedRole = (role || "").toString().trim().toLowerCase();

  if (normalizedRole === "admin") {
    return [
      "Pending Admin Approval",
      "Under Admin Review",
      "Rejected by Admin",
      "Approved",
    ];
  }

  if (normalizedRole === "supervisor" || normalizedRole === "employee" || normalizedRole === "intern") {
    return [
      "Pending Supervisor Approval",
      "Under Supervisor Review",
      "Rejected by Supervisor",
      "Pending Admin Approval",
      "Under Admin Review",
      "Rejected by Admin",
      "Approved",
    ];
  }

  return [];
};
