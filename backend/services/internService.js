import User from "../models/User.js";
import UserRole from "../models/UserRole.js";

export const getPublic = async () => {
  const internRole = await UserRole.findOne({ name: "Intern" });

  if (!internRole) {
    return [];
  }

  const interns = await User.find({
    role_id: internRole._id,
    status: "Active",
  }).select("name lastName email position bio profileImageURL");

  return {
    status: "Success",
    code: 200,
    data: interns
  };
};
