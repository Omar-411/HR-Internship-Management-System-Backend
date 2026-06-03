// Utility function to export stats to CSV/Excel
import { Parser } from "json2csv";
import ExcelJS from "exceljs";

// Export stats to CSV
export const exportStatsCSV = (stats, selectedKPIs, res, fileName) => {
  if (!stats || !stats.length) {
    return res.status(404).json({ 
      status: "Error", 
      message: "No stats found for export!" 
    });
  }

  // Build dynamic rows: include User, PeriodType, StartDate, EndDate + only selected KPIs
  const data = stats.map((s) => {
    const row = {
      Name: s.userId?.name ? `${s.userId.name} ${s.userId.lastName || ""}` : "All",
      StartDate: s.startDate.toISOString().split("T")[0],
      EndDate: s.endDate.toISOString().split("T")[0],
    };

    // Only add the selected KPIs as columns
    selectedKPIs.forEach((kpi) => {
      if (s[kpi] !== undefined) {
        row[kpi] = s[kpi];
      }
    });

    return row;
  });

  // Only include the selected KPIs as headers
  const fields = ["Name", "StartDate", "EndDate", ...selectedKPIs];
  const parser = new Parser({ fields });
  const csv = parser.parse(data);

  res.header("Content-Type", "text/csv");
  res.attachment(fileName);
  
  return res.send(csv);
};

// Export stats to Excel
export const exportStatsExcel = async (stats, selectedKPIs, res, fileName) => {
  if (!stats || !stats.length) {
    return res.status(404).json({ 
      status: "Error", 
      message: "No stats found for the export!" 
    });
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Attendance Stats");

  // Build dynamic columns: always include Name, StartDate, EndDate + selected KPIs
  const columns = [
    { header: "Name", key: "Name", width: 25 },
    { header: "StartDate", key: "StartDate", width: 15 },
    { header: "EndDate", key: "EndDate", width: 15 },
    ...selectedKPIs.map(kpi => ({ header: kpi, key: kpi, width: 20 }))
  ];

  worksheet.columns = columns;

  // Add rows dynamically based on selected KPIs
  stats.forEach(s => {
    const row = {
      Name: s.userId?.name ? `${s.userId.name} ${s.userId.lastName || ""}` : "All",
      StartDate: s.startDate.toISOString().split("T")[0],
      EndDate: s.endDate.toISOString().split("T")[0],
    };
    selectedKPIs.forEach(kpi => {
      if (s[kpi] !== undefined) {
        row[kpi] = s[kpi];
      }
    });
    worksheet.addRow(row);
  });

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

  // Style data rows with borders (except the header)
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell(cell => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    });
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
