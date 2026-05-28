// Attendance export helper functions for CSV and Excel formats
import { Parser } from "json2csv";
import ExcelJS from "exceljs";
import QuickChart from "quickchart-js"; // For generating charts in Excel exports

// Helper functions of returning the summary records
const calculateSummary = (data) => {
  const total = data.length;
  const present = data.filter(r => r.Status?.toLowerCase() === "present").length;
  const late = data.filter(r => r.Status?.toLowerCase() === "late").length;
  const absent = data.filter(r => r.Status?.toLowerCase() === "absent").length;
  const leave = data.filter(r => r.Status?.toLowerCase() === "leave").length;
  const dayOff = data.filter(r => r.Status?.toLowerCase() === "day-off").length;

  return { total, present, late, absent, leave, dayOff };
};

// CSV Export function
export const exportCSV = (data, res, fileName) => {
  // Calculate the summary records
  const summary = calculateSummary(data);
  const present = summary.present;
  const late = summary.late;
  const absent = summary.absent;
  const leave = summary.leave;
  const dayOff = summary.dayOff;

  const parser = new Parser();
  let csv = parser.parse(data);

  // Add the summary rows
  csv += `\n\n`;
  csv += `Attendance records Summary\n`;
  csv += `Total Days, ${summary.total} Days\n`;
  csv += `Present, ${present} Day(s)\n`;
  csv += `Late, ${late} Day(s)\n`;
  csv += `Absent, ${absent} Day(s)\n`;
  csv += `Leave, ${leave} Day(s)\n`;
  csv += `Day Off, ${dayOff} Day(s)\n`;

  res.header("Content-Type", "text/csv");
  res.attachment(fileName); // The filename will be the user's name + the filter type (e.g., "John_Doe_Monthly_Attendance.csv")
  
  return res.send(csv);
};

// Excel Export function
export const exportExcel = async (data, res, fileName, includeName = false) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Attendance");

  // Define the columns based on the includeName flag
  const columns = [];

  if (includeName) {
    columns.push({ header: "Name", key: "Name", width: 25 });
  }

  columns.push(
    { header: "Date", key: "Date", width: 15 },
    { header: "Check In", key: "CheckIn", width: 20 },
    { header: "Check Out", key: "CheckOut", width: 20 },
    { header: "Status", key: "Status", width: 15 }
  );
  
  // Include the columns in the worksheet
  worksheet.columns = columns;

  // Style the header (borders + background color)
  worksheet.getRow(1).eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern:'solid',
      fgColor:{ argb:'89D2DC' }
    };
    cell.font = { bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  worksheet.addRows(data);

  // Style the data rows with borders (except the header)
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  });

  // Add a summary section (total days, present, late, absent) at the end of the worksheet
  const summary = calculateSummary(data);
  const present = summary.present;
  const late = summary.late;
  const absent = summary.absent;
  const leave = summary.leave;
  const dayOff = summary.dayOff;

  // Create the Summary Chart
  const summaryChart = new QuickChart();
  summaryChart.setConfig({
    type: "pie",
    data: {
      labels: ["Present", "Late", "Absent", "Leave", "Day Off"],
      datasets: [{
        data: [present, late, absent, leave, dayOff],
        backgroundColor: ["#232ED1", "#89D2DC", "#6564DB", "#FF6384", "#FFCE56"],
      }],
    },
    options: {
      plugins: { 
        legend: { position: "bottom" },
        datalabels: {              
          color: "white",             
          font: { weight: "bold", size: 16 },
          formatter: (value, ctx) => `${value}`,
        } 
      },
      title: { display: true, text: "Attendance Records Summary" }
    }
  });
  const summaryChartBuffer = await summaryChart.toBinary();

  // Add the chart as an image
  const summaryImageId = workbook.addImage({ buffer: summaryChartBuffer, extension: "png" });

  // Place the summary chart below the data table
  worksheet.addImage(summaryImageId, {
    tl: { col: 1, row: worksheet.rowCount + 2 },
    ext: { width: 500, height: 300 },
  });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );

  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${fileName}`
  );

  await workbook.xlsx.write(res);
  
  res.end();
};
