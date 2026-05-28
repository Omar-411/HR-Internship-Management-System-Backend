import fs from "fs";
import csv from "csv-parser";

/**
 * Parses a CSV file and returns a Promise that resolves to an array of objects.
 * Uses csv-parser stream processing for low-memory overhead.
 * @param {string} filePath - Path to the CSV file.
 * @returns {Promise<Array<object>>} Array of parsed row objects.
 */
export function parseCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`File not found: ${filePath}`));
    }
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => {
        results.push(data);
      })
      .on("end", () => {
        resolve(results);
      })
      .on("error", (err) => {
        reject(err);
      });
  });
}
