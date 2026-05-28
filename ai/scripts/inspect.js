import fs from "fs";
import csv from "csv-parser";

let count = 0;
let sample = null;

const fileStream = fs.createReadStream("./data/raw/dataset.csv");
const csvStream = fileStream.pipe(csv());

csvStream
  .on("data", (row) => {
    if (count === 0) {
      sample = row;
      console.log("Columns:", Object.keys(row));
      console.log("Sample row:", row);
    }

    count++;

    if (count >= 10) {
      console.log("Stopped early at 10 rows for safety.");
      fileStream.destroy();
      csvStream.destroy();
    }
  })
  .on("end", () => {
    console.log("Done. Total processed:", count);
  })
  .on("error", (err) => {
    // Suppress error caused by destroying stream early
    if (err.code !== "ERR_STREAM_PREMATURE_CLOSE") {
      console.error("Stream error:", err);
    }
  });