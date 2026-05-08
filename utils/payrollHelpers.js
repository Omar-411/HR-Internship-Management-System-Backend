import Payroll from "../models/Payroll.js";
import Resignation from "../models/Resignation.js";
import Attendance from "../models/Attendance.js";
import Timetable from "../models/Timetable.js";
import SpecialShift from "../models/SpecialShift.js";
import LeaveRequest from "../models/LeaveRequest.js";
import LeaveType from "../models/LeaveType.js";
import AllowanceType from "../models/AllowanceType.js";
import BonusType from "../models/BonusType.js";
import EmployeeAllowance from "../models/EmployeeAllowance.js";
import EmployeeBonus from "../models/EmployeeBonus.js";
import AppError from "./AppError.js";
import { errors as commonErrors } from "../errors/commonErrors.js";
import { errors } from "../errors/payrollErrors.js";
import {
  getMonthRange,
  getHoursDifference,
  getWeekNumber,
  getDatesBetween,
  normalizeTime,
} from "./timeHelpers.js";

// Get the hourly rate based on the base salary
export const getHourlyRate = (baseSalary, standardMonthlyHours) => {
  if (!standardMonthlyHours || standardMonthlyHours <= 0) {
    throw new AppError(
      errors.INVALID_MONTHLY_HOURS.message,
      errors.INVALID_MONTHLY_HOURS.code,
      errors.INVALID_MONTHLY_HOURS.errorCode,
      errors.INVALID_MONTHLY_HOURS.suggestion,
    );
  }

  return round(baseSalary / standardMonthlyHours);
};

// Helper function to build a map of timetables by date
const buildTimetableMap = (timetables) => {
  const map = new Map();

  timetables.forEach((t) => {
    map.set(new Date(t.date).toDateString(), t);
  });

  return map;
};

// Helper function to build a weekly structure of worked hours and expected hours
const buildWeeklyStructure = async (attendances, timetableMap) => {
  const weeks = new Map();

  for (const record of attendances) {
    if (
      !["present", "late"].includes(record.status) ||
      !record.checkInTime ||
      !record.checkOutTime
    )
      continue;

    const date = new Date(record.date);
    const weekKey = `${date.getFullYear()}-${getWeekNumber(date)}`;

    const workedHours = getHoursDifference(
      record.checkInTime,
      record.checkOutTime,
    );

    const timetable = timetableMap.get(date.toDateString());

    const expectedHours = await resolveExpectedHours(timetable, SpecialShift);

    if (!weeks.has(weekKey)) {
      weeks.set(weekKey, []);
    }

    weeks.get(weekKey).push({
      date,
      workedHours,
      expectedHours,
      timetable,
    });
  }

  return weeks;
};

// Helper function to resolve expected hours for a given timetable entry
const resolveExpectedHours = async (timetable, SpecialShift) => {
  // Case 1: Holiday, day off, or no timetable entry: 0 expected hours
  if (!timetable || timetable.type === "Day Off" || timetable.isPublicHoliday) {
    return 0;
  }

  // Case 2: Special Shift
  let shift = null;
  if (timetable.specialShiftData) {
    shift = timetable.specialShiftData;
  } else if (timetable.specialShiftId) {
    shift = await SpecialShift.findById(timetable.specialShiftId);
  }

  if (shift) {
    return shift.periods.reduce((sum, p) => {
      return sum + getHoursDifference(p.startTime, p.endTime);
    }, 0);
  }

  // Case 3: Regular shift
  return getHoursDifference(timetable.startTime, timetable.endTime);
};

// Helper function to calculate the total overtime pay based on the weekly structure
const calculateWeeklyOvertime = (weeks, baseSalary, config, hourlyRate) => {
  let totalOvertimePay = 0;
  let totalOvertimeHours = 0;

  for (const week of weeks.values()) {
    let weeklyWorked = week.reduce((sum, d) => sum + d.workedHours, 0);
    let remainingExcess = Math.max(0, weeklyWorked - 48);

    for (const day of week) {
      const overtimeHours = Math.max(0, day.workedHours - day.expectedHours);
      if (overtimeHours <= 0) continue;

      totalOvertimeHours += overtimeHours;

      let rateMultiplier = 1.25;

      if (day.timetable?.isPublicHoliday) rateMultiplier = 2.0;
      else if (!day.timetable || day.timetable.type === "Day Off")
        rateMultiplier = 1.5;

      if (remainingExcess > 0) {
        const excessUsed = Math.min(overtimeHours, remainingExcess);

        totalOvertimePay += excessUsed * hourlyRate * 1.75;
        remainingExcess -= excessUsed;

        const normalPart = overtimeHours - excessUsed;

        if (normalPart > 0) {
          totalOvertimePay += normalPart * hourlyRate * rateMultiplier;
        }
      } else {
        totalOvertimePay += overtimeHours * hourlyRate * rateMultiplier;
      }
    }
  }

  return {
    amount: round(totalOvertimePay),
    hours: round(totalOvertimeHours),
  };
};

// Calculate the total deduction for late arrivals in a given month
const calculateLateHours = (
  checkInTime,
  expectedStartTime,
  gracePeriod = 5,
) => {
  if (!checkInTime || !expectedStartTime) return 0;

  const inT = normalizeTime(checkInTime);
  const startT = normalizeTime(expectedStartTime);

  if (!inT || !startT) return 0;

  const checkInMinutes = inT.h * 60 + inT.m;
  const startMinutes = startT.h * 60 + startT.m;

  const lateMinutes = checkInMinutes - startMinutes - gracePeriod;

  return lateMinutes > 0 ? lateMinutes / 60 : 0;
};

// Helper function to calculate the family deduction snapshot for IRPP calculation
const calculateFamilySnapshot = (user, config) => {
  let spouse = { eligible: false, amount: 0 };
  let children = [];
  let total = 0;

  const now = new Date();

  // Spouse deduction (Only for married employees who are heads of family)
  if (user.socialStatus === "Married" && user.isHeadOfFamily) {
    const amount = config.irpp.family?.spouse || 300;

    spouse = {
      eligible: true,
      amount,
    };

    total += amount;
  }

  // Children
  for (const child of user.children || []) {
    const birthDate = new Date(child.dateOfBirth);
    let age = now.getFullYear() - birthDate.getFullYear();

    const m = now.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) {
      age--;
    }

    let category = "normal";
    let amount = config.irpp.family?.perChild || 0;

    // Disabled (priority)
    if (child.isDisabled) {
      category = "disabled";
      amount = config.irpp.family?.disabledChild || 1200;
    }
    // Student
    else if (child.isStudent && !child.hasScholarship && age < 25) {
      category = "student";
      amount = config.irpp.family?.studentChild || 1000;
    }

    children.push({ category, amount });
    total += amount;
  }

  return { spouse, children, total };
};

// Function to round numbers to 3 decimal places (For currency calculations in Tunisia - millimes)
export const round = (value) => {
  return Math.round(value * 1000) / 1000; // Round to 3 decimal places
};

// Calculate the prorated salary for an employee
export const calculateProratedSalary = async (
  employeeId,
  month,
  year,
  user,
) => {
  // Get the month start and end dates
  const { monthStart, monthEnd } = getMonthRange(year, month);

  // Check if the employee has an approved or scheduled resignation that affects the payroll for the month
  const resignation = await Resignation.findOne({
    employeeId,
    status: { $in: ["approved", "scheduled_exit", "inactive"] },
    "payrollImpact.to": {
      $gte: monthStart,
      $lte: monthEnd,
    },
  });

  // The start date for payroll calculation is the month start or the employee's contract join date (If mid-month joiner)
  const startDate = new Date(
    Math.max(
      monthStart,
      user.employment.contractJoinDate
        ? user.employment.contractJoinDate
        : monthStart,
    ),
  );

  // The end date for payroll calculation is the month end, the resignation last working date (if there is one), or the contract end date
  const endDate = new Date(
    Math.min(monthEnd, resignation?.payrollImpact?.to || monthEnd),
  );

  // If the start date is after the end date, it means the employee did not work at all during the month, so the prorated salary is 0
  if (startDate > endDate) {
    return {
      proratedSalary: 0,
      workedDays: 0,
    };
  }

  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  // Calculate the number of days worked in the month
  const workedDays = Math.floor((endDate - startDate) / MS_PER_DAY) + 1;
  const totalDaysInMonth = monthEnd.getDate();

  // Calculate the prorated salary
  const proratedSalary = (user.salary.base / totalDaysInMonth) * workedDays;

  return {
    proratedSalary,
    workedDays,
  };
};

// Build the allowances snapshot for the payroll record
export const buildAllowancesSnapshot = async (userId, month, year) => {
  const payrollDate = new Date(Date.UTC(year, month - 1, 1));

  // Get active allowances for that period
  const employeeAllowances = await EmployeeAllowance.find({
    userId,
    isActive: true,
    effectiveFrom: { $lte: payrollDate },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: payrollDate } }],
  }).populate("allowanceTypeId");

  let snapshot = [];
  let taxable = 0;
  let nonTaxable = 0;

  for (const ea of employeeAllowances) {
    const type = ea.allowanceTypeId;
    if (!type || !type.active) continue;

    const amount = ea.amount ?? type.defaultAmount;

    snapshot.push({
      code: type.code,
      name: type.name,
      amount,
      isTaxable: type.isTaxable,
    });

    if (type.isTaxable) taxable += amount;
    else nonTaxable += amount;
  }

  return {
    snapshot,
    taxable,
    nonTaxable,
  };
};

// Build the bonuses snapshot for the payroll record
export const buildBonusesSnapshot = async (userId, month, year) => {
  const payrollDate = new Date(Date.UTC(year, month - 1, 1));

  const employeeBonuses = await EmployeeBonus.find({
    userId,
    isActive: true,
    effectiveFrom: { $lte: payrollDate },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: payrollDate } }],
  }).populate("bonusTypeId");

  let snapshot = [];
  let total = 0;

  for (const eb of employeeBonuses) {
    const type = eb.bonusTypeId;
    if (!type || !type.active) continue;

    const amount = eb.amount ?? type.defaultAmount;

    snapshot.push({
      code: type.code,
      name: type.name,
      amount,
      isTaxable: type.isTaxable,
    });

    total += amount;
  }

  return {
    snapshot,
    total,
  };
};

// Calculate the total overtime compensation for an employee based on their attendances and timetables in a given month
export const calculateOvertime = async (
  employeeId,
  month,
  year,
  baseSalary,
  config,
  hourlyRate,
) => {
  const { monthStart, monthEnd } = getMonthRange(year, month);

  // Fetch attendances and timetables for the month
  const [attendances, timetables] = await Promise.all([
    Attendance.find({
      userId: employeeId,
      status: { $in: ["present", "late"] },
      date: { $gte: monthStart, $lte: monthEnd },
    }),
    Timetable.find({
      userId: employeeId,
      date: { $gte: monthStart, $lte: monthEnd },
    }),
  ]);

  const timetableMap = buildTimetableMap(timetables);

  const weeks = await buildWeeklyStructure(attendances, timetableMap);

  return calculateWeeklyOvertime(weeks, baseSalary, config, hourlyRate);
};

// Calculate the total deduction for absences in a given month
export const calculateAbsences = async (
  employeeId,
  month,
  year,
  baseSalary,
  config,
  hourlyRate,
) => {
  const { monthStart, monthEnd } = getMonthRange(year, month);

  const [absences, timetables] = await Promise.all([
    Attendance.find({
      userId: employeeId,
      status: "absent",
      date: { $gte: monthStart, $lte: monthEnd },
    }),
    Timetable.find({
      userId: employeeId,
      date: { $gte: monthStart, $lte: monthEnd },
    }),
  ]);

  const timetableMap = buildTimetableMap(timetables);

  let totalDeduction = 0;
  for (const absence of absences) {
    const dateKey = new Date(absence.date).toDateString();
    const timetable = timetableMap.get(dateKey);

    // Get the expected hours for the day based on the timetable and special shifts
    const expectedHours = await resolveExpectedHours(timetable, SpecialShift);

    // Deduct based on expected hours for the day
    totalDeduction += expectedHours * hourlyRate;
  }

  return round(totalDeduction);
};

// Calculate late arrivals deduction based on the number of late hours
export const calculateLateDeduction = async (
  employeeId,
  month,
  year,
  baseSalary,
  config,
  hourlyRate,
) => {
  const { monthStart, monthEnd } = getMonthRange(year, month);

  // Fetch late attendances and timetables for the month to calculate late hours
  const [attendances, timetables] = await Promise.all([
    Attendance.find({
      userId: employeeId,
      status: "late",
      date: { $gte: monthStart, $lte: monthEnd },
    }),
    Timetable.find({
      userId: employeeId,
      date: { $gte: monthStart, $lte: monthEnd },
    }),
  ]);

  // Map timetable by day for quick access
  const timetableMap = buildTimetableMap(timetables);

  let totalLateHours = 0;
  for (const record of attendances) {
    if (record.checkInTime) {
      const timetable = timetableMap.get(new Date(record.date).toDateString());

      const gracePeriod = timetable?.gracePeriod || 5;

      const expectedStartTime = timetable?.startTime;

      totalLateHours += calculateLateHours(
        record.checkInTime,
        expectedStartTime,
        gracePeriod,
      );
    }
  }

  return round(totalLateHours * hourlyRate || 0);
};

// Calculate the unpaid leave deduction for an employee based on the number of leave days taken in a month
export const calculateUnpaidLeaveDeduction = async (
  employeeId,
  month,
  year,
  baseSalary,
  config,
  hourlyRate,
) => {
  const { monthStart, monthEnd } = getMonthRange(year, month);

  // Get approved leave requests
  const leaveRequests = await LeaveRequest.find({
    employeeId,
    status: "Approved",
    $or: [{ startDate: { $lte: monthEnd }, endDate: { $gte: monthStart } }],
  }).populate("typeId");

  // Keep only the unpaid leaves (Paid leaves do not affect the salary)
  const unpaidLeaves = leaveRequests.filter(
    (lr) => lr.typeId && !lr.typeId.isPaid,
  );

  // Fetch the employee's timetable for the month to determine expected working hours on leave days
  const timetables = await Timetable.find({
    userId: employeeId,
    date: { $gte: monthStart, $lte: monthEnd },
  });

  const timetableMap = buildTimetableMap(timetables);
  let totalUnpaidHours = 0;

  for (const leave of unpaidLeaves) {
    const dates = getDatesBetween(leave.startDate, leave.endDate);

    for (const date of dates) {
      if (date < monthStart || date > monthEnd) continue;

      const key = new Date(date).toDateString();
      const timetable = timetableMap.get(key);

      // Get the expected hours for the day based on the timetable and special shifts
      const expectedHours = await resolveExpectedHours(timetable, SpecialShift);

      totalUnpaidHours += expectedHours;
    }
  }

  return round(totalUnpaidHours * hourlyRate);
};

// Calculate the IRPP tax based on the gross salary using the "Loi de finances 2026" rules
export const calculateIRPPMonthly = (monthlyTaxableIncome, config, user) => {
  // Annualize the taxable income to apply the annual tax brackets
  const annualIncome = monthlyTaxableIncome * 12;

  // Calculate the frais professionnels deduction based on the annual income
  const fraisPro = Math.min(
    annualIncome * config.irpp.fraisPro.rate,
    config.irpp.fraisPro.ceiling,
  );

  // Get the family snapshot to determine the total family deduction
  const family = calculateFamilySnapshot(user, config);

  // Calculate the net annual taxable income after deductions
  const netAnnualTaxable = Math.max(0, annualIncome - fraisPro - family.total);
  if (netAnnualTaxable <= 0) {
    return {
      monthlyTax: 0,
      annualTax: 0,
      fraisPro: round(fraisPro),
      family,
      netAnnualTaxable: 0,
    };
  }

  let tax = 0;
  let previousLimit = 0;

  const sortedBrackets = [...config.irpp.brackets].sort(
    (a, b) => a.limit - b.limit,
  );

  for (const bracket of sortedBrackets) {
    if (netAnnualTaxable > previousLimit) {
      const taxableAmount =
        Math.min(netAnnualTaxable, bracket.limit) - previousLimit;

      tax += taxableAmount * bracket.rate;
      previousLimit = bracket.limit;
    } else break;
  }

  const annualTax = tax;
  const monthlyTax = annualTax / 12;

  return {
    monthlyTax: round(monthlyTax),
    annualTax: round(annualTax),
    fraisPro: round(fraisPro),
    family,
    netAnnualTaxable: round(netAnnualTaxable),
  };
};

// Calculate the CSS contribution based on the gross salary and CNSS contribution
export const calculateCSS = (netTaxableMonthly, config) => {
  const annualNetTaxable = netTaxableMonthly * 12;

  if (annualNetTaxable <= config.css.threshold) return 0;

  const annualCSS = annualNetTaxable * config.css.rate;

  return annualCSS / 12;
};

// Check if it's an admin or owner of the payroll record
export const canAccessPayroll = (user, employeeId) => {
  const isAdmin = user.role === "Admin";
  const isOwner = employeeId.toString() === user.id.toString();

  if (!isAdmin && !isOwner) {
    throw new AppError(
      errors.UNAUTHORIZED_PAYROLL_ACCESS.message,
      errors.UNAUTHORIZED_PAYROLL_ACCESS.code,
      errors.UNAUTHORIZED_PAYROLL_ACCESS.errorCode,
      errors.UNAUTHORIZED_PAYROLL_ACCESS.suggestion,
    );
  }
};

// Mark payroll as dirty for recalculation when there are changes that affect the payroll (e.g., attendance changes)
export const markPayrollDirty = async (
  employeeId,
  date = new Date(),
  message = "Changes require payroll recalculation",
) => {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  await Payroll.updateMany(
    { employeeId, month, year, status: { $in: ["draft", "validated"] } },
    {
      $set: {
        recalculationRequired: true,
        recalculationMessage: message,
      },
    },
  );
};

// Compute the payroll: Engine of the payroll calculation
export const computePayroll = async (user, month, year, config) => {
  // Calculate the prorated salary and get the number of worked days in the month
  const { proratedSalary: baseSalary, workedDays } =
    await calculateProratedSalary(user._id, month, year, user);

  console.log("baseSalary:", baseSalary);

  if (workedDays <= 0) {
    throw new AppError(
      errors.INVALID_WORKED_DAYS.message,
      errors.INVALID_WORKED_DAYS.code,
      errors.INVALID_WORKED_DAYS.errorCode,
      errors.INVALID_WORKED_DAYS.suggestion,
    );
  }

  if (baseSalary <= 0) {
    throw new AppError(
      errors.INVALID_BASE_SALARY.message,
      errors.INVALID_BASE_SALARY.code,
      errors.INVALID_BASE_SALARY.errorCode,
      errors.INVALID_BASE_SALARY.suggestion,
    );
  }

  // Calculate the hourly rate
  const hourlyRate = getHourlyRate(
    baseSalary,
    config.payroll.standardMonthlyHours,
  );

  console.log("hourlyRate:", hourlyRate);

  // Calculate allowances snapshot and totals
  const {
    snapshot: allowancesSnapshot,
    taxable: taxableAllowances,
    nonTaxable: nonTaxableAllowances,
  } = await buildAllowancesSnapshot(user._id, month, year);

  console.log("taxableAllowances:", taxableAllowances);
  console.log("nonTaxableAllowances:", nonTaxableAllowances);

  const { snapshot: bonusesSnapshot, total: totalBonuses } =
    await buildBonusesSnapshot(user._id, month, year);

  console.log("totalBonuses:", totalBonuses);

  // Calculate overtime compensation based on attendances and timetables
  const { amount: overtimeAmount, hours: overtimeHours } =
    await calculateOvertime(
      user._id,
      month,
      year,
      baseSalary,
      config,
      hourlyRate,
    );
  console.log("overtimeAmount:", overtimeAmount);
  console.log("overtimeHours:", overtimeHours);

  // Calculate deductions for absences, late arrivals, and unpaid leaves
  const absences = await calculateAbsences(
    user._id,
    month,
    year,
    baseSalary,
    config,
    hourlyRate,
  );

  console.log("absences:", absences);

  const lateArrivals = await calculateLateDeduction(
    user._id,
    month,
    year,
    baseSalary,
    config,
    hourlyRate,
  );
  console.log("lateArrivals:", lateArrivals);

  const unpaidLeave = await calculateUnpaidLeaveDeduction(
    user._id,
    month,
    year,
    baseSalary,
    config,
    hourlyRate,
  );

  console.log("unpaidLeave:", unpaidLeave);

  // Calculate the gross salary
  const grossSalary = round(
    baseSalary + totalBonuses + overtimeAmount + taxableAllowances,
  );

  console.log("grossSalary:", grossSalary);

  // Calculate the CNSS contribution based on the gross salary (capped at the CNSS ceiling)
  const cnssBase = Math.min(grossSalary, config.cnss.ceiling);
  const cnss = round(cnssBase * config.cnss.rate);

  // Calculate the taxable income for IRPP
  const taxableIncome = grossSalary - cnss;

  // Calculate the IRPP tax based on the taxable income and get the family deductions and frais professionnels
  const irpp = calculateIRPPMonthly(taxableIncome, config, user);

  const netTaxableIncome = taxableIncome - irpp.monthlyTax;

  // Calculate the CSS contribution based on the net taxable income
  const css = round(calculateCSS(netTaxableIncome, config));

  // Calculate the total deductions
  const totalDeductions =
    cnss + irpp.monthlyTax + css + absences + lateArrivals + unpaidLeave;

  // Calculate the net salary
  const netSalary = round(grossSalary - totalDeductions + nonTaxableAllowances);

  return {
    baseSalary,
    hourlyRate,
    workedDays,

    earnings: {
      bonuses: bonusesSnapshot,
      allowances: allowancesSnapshot,
      overtime: {
        amount: overtimeAmount,
        hours: overtimeHours,
      },
      totals: {
        bonuses: totalBonuses,
        taxableAllowances,
        nonTaxableAllowances,
      },
      total: totalBonuses + taxableAllowances + overtimeAmount,
    },

    family: irpp.family,

    cnssBase,
    taxableIncome,
    netTaxableIncome,
    fraisProfessionnels: irpp.fraisPro,

    deductions: {
      cnss,
      css,
      irpp: irpp.monthlyTax,
      absences,
      lateArrivals,
      unpaidLeave,
      total: totalDeductions,
    },

    grossSalary,
    netSalary,
  };
};
