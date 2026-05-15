import User from "../models/User.js";

/*
    When a leave type's defaultDays is updated, we need to sync the change to all users who have a balance for that leave type. 
    This function calculates the difference between the old and new default days and updates each user's remaining days accordingly, 
    ensuring that no user's remaining days become negative and that even old users who had a different defaultDays before still get 
    the correct adjustment based on the new defaultDays.
*/
export const syncLeaveTypeToUsers = async (
  leaveTypeId,
  oldDefaultDays,
  newDefaultDays,
) => {
  const delta = newDefaultDays - oldDefaultDays;

  // If there's no change in default days, skip the update
  if (delta === 0) return;

  // Find all users who have a balance for this leave type
  const users = await User.find({
    "leaveBalances.typeId": leaveTypeId,
  });

  // Prepare bulk update operations for all affected users
  const bulkOps = users.map((user) => {
    const updatedBalances = user.leaveBalances.map((lb) => {
      if (!lb.typeId.equals(leaveTypeId)) return lb;

      const newRemaining = Math.max(0, lb.remainingDays + delta);

      return {
        ...lb.toObject(),
        remainingDays: newRemaining,
      };
    });

    return {
      updateOne: {
        filter: { _id: user._id },
        update: {
          $set: {
            leaveBalances: updatedBalances,
          },
        },
      },
    };
  });

  if (bulkOps.length > 0) {
    await User.bulkWrite(bulkOps);
  }
};

// Add a new leave balance wallet for the users when a new leave type is created or restored
export const addLeaveTypeToUsers = async (leaveType) => {
  const bulkOps = [];

  for (const user of users) {
    // Check if the user already has a balance for this leave type to avoid duplicates
    const alreadyExists = user.leaveBalances.some((balance) =>
      balance.typeId.equals(leaveType._id),
    );

    if (alreadyExists) continue;

    // Add the new leave wallet with the default days for this leave type
    bulkOps.push({
      updateOne: {
        filter: { _id: user._id },
        update: {
          $push: {
            leaveBalances: {
              typeId: leaveType._id,
              remainingDays: leaveType.defaultDays,
            },
          },
        },
      },
    });
  }

  if (bulkOps.length > 0) {
    await User.bulkWrite(bulkOps);
  }
};

// Remove the leave balance wallet for the users when a leave type is archived
export const removeLeaveTypeFromUsers = async (leaveTypeId) => {
  // Remove the leave balance from all users
  await User.updateMany(
    {},
    {
      $pull: {
        leaveBalances: {
          typeId: leaveTypeId,
        },
      },
    },
  );
};
