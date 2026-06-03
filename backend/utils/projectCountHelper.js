import User from "../models/User.js";

// Increment the projectsCount of the users 
export const incrementUsersProjectCount = async (userIds, session = null) => {
  if (!userIds.length) return;

  await User.updateMany(
    {
      _id: { $in: userIds },
      projectsCount: { $lt: 2 },
    },
    {
      $inc: { projectsCount: 1 },
    },
    { session }
  );
};

// Decrement the projectsCount of the users 
export const decrementUsersProjectCount = async (userIds, session = null) => {
  if (!userIds.length) return;

  await User.updateMany(
    {
      _id: { $in: userIds },
      projectsCount: { $gt: 0 }, // prevent negative
    },
    {
      $inc: { projectsCount: -1 },
    },
    { session }
  );
};
