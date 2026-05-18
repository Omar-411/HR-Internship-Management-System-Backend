import ExcelJS from "exceljs";
import Payroll from "../models/Payroll.js";
import AppError from "../utils/AppError.js";

export const exportPayslipToExcel = async (payrollId, res) => {
  const payroll = await Payroll.findById(payrollId).populate("employeeId", "name lastName position");
  
  if (!payroll) {
    throw new AppError("No payslip found for the provided identifier", 404);
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Payslip");

  const employee = payroll.employeeId;
  const fullName = `${employee.name} ${employee.lastName}`;
  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(payroll.year, payroll.month - 1));
  const periodLabel = `${monthName} ${payroll.year}`;

  // Formatting helper
  const fmt = (val) => (val || 0).toLocaleString("fr-TN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " DT";

  // Setup basic info
  sheet.columns = [
    { header: "Description", key: "label", width: 35 },
    { header: "Amount", key: "value", width: 20 },
  ];

  // Header Section
  sheet.addRow({ label: "PAYSLIP", value: "" });
  sheet.addRow({ label: "Employee Name:", value: fullName });
  sheet.addRow({ label: "Position:", value: employee.position || "N/A" });
  sheet.addRow({ label: "Period:", value: periodLabel });
  sheet.addRow({ label: "Status:", value: payroll.status.toUpperCase() });
  sheet.addRow({}); // Empty row

  // Earnings Section
  sheet.addRow({ label: "EARNINGS", value: "" });
  sheet.addRow({ label: "Base Salary", value: fmt(payroll.baseSalary) });
  
  payroll.earnings.allowances.forEach(a => {
    sheet.addRow({ label: `Allowance: ${a.name}`, value: fmt(a.amount) });
  });

  payroll.earnings.bonuses.forEach(b => {
    sheet.addRow({ label: `Bonus: ${b.name}`, value: fmt(b.amount) });
  });

  if (payroll.earnings.overtime?.amount > 0) {
    sheet.addRow({ label: "Overtime", value: fmt(payroll.earnings.overtime.amount) });
  }

  sheet.addRow({ label: "Total Gross Salary", value: fmt(payroll.grossSalary) });
  sheet.addRow({}); // Empty row

  // Deductions Section
  sheet.addRow({ label: "DEDUCTIONS", value: "" });
  sheet.addRow({ label: "CNSS", value: fmt(payroll.deductions.cnss) });
  sheet.addRow({ label: "CSS", value: fmt(payroll.deductions.css) });
  sheet.addRow({ label: "IRPP", value: fmt(payroll.deductions.irpp) });
  
  if (payroll.deductions.absences > 0) {
    sheet.addRow({ label: "Absences", value: fmt(payroll.deductions.absences) });
  }
  if (payroll.deductions.lateArrivals > 0) {
    sheet.addRow({ label: "Late Arrivals", value: fmt(payroll.deductions.lateArrivals) });
  }
  if (payroll.deductions.unpaidLeave > 0) {
    sheet.addRow({ label: "Unpaid Leave", value: fmt(payroll.deductions.unpaidLeave) });
  }

  sheet.addRow({ label: "Total Deductions", value: fmt(payroll.deductions.total) });
  sheet.addRow({}); // Empty row

  // Attendance & Final
  sheet.addRow({ label: "ATTENDANCE", value: "" });
  sheet.addRow({ label: "Worked Days", value: `${payroll.workedDays} days` });
  sheet.addRow({});
  
  const netRow = sheet.addRow({ label: "FINAL NET SALARY", value: fmt(payroll.netSalary) });
  netRow.font = { bold: true, size: 12 };

  // Styling
  sheet.getRow(1).font = { bold: true, size: 14 };
  const sections = ["EARNINGS", "DEDUCTIONS", "ATTENDANCE", "PAYSLIP"];
  sheet.eachRow((row) => {
    if (sections.includes(row.getCell(1).value)) {
      row.font = { bold: true };
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F3F4F6' } };
    }
    row.getCell(2).alignment = { horizontal: 'right' };
  });

  // Headers for the stream
  const safeName = fullName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="payslip_${safeName}_${payroll.month}_${payroll.year}.xlsx"`);

  await workbook.xlsx.write(res);
  res.end();
};
