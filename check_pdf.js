import fetch from 'node-fetch';
import pdfModule from 'pdf-parse';

const pdf = pdfModule.default || pdfModule;

async function extractCvTextFromUrl(cvURL) {
  try {
    console.log("Fetching", cvURL);
    const response = await fetch(cvURL);
    if (!response.ok) {
        console.log("Response not OK", response.status);
        return "";
    }
    const contentType = response.headers.get("content-type") || "";
    console.log("Content Type:", contentType);
    const buffer = Buffer.from(await response.arrayBuffer());
    const isPdfBuffer = buffer.subarray(0, 4).toString("utf8") === "%PDF";
    console.log("isPdfBuffer:", isPdfBuffer);

    if (
      contentType.includes("pdf") ||
      contentType.includes("octet-stream") ||
      cvURL.toLowerCase().includes(".pdf") ||
      isPdfBuffer
    ) {
      console.log("Parsing PDF...");
      const parsed = await pdf(buffer);
      console.log("Parsed length:", parsed.text.length);
      return parsed.text || "";
    }
    console.log("Not recognized as PDF");
    return "";
  } catch (err) {
    console.error("Error during extraction:", err);
    return "";
  }
}

extractCvTextFromUrl("https://res.cloudinary.com/dcboonk1t/raw/upload/v1779644495/hrcom/cvs/mateo.pdf").then(() => process.exit(0));
