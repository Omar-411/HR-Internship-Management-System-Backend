import Groq from "groq-sdk";
import dotenv from "dotenv";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import path from "path";
import { embeddingConfig } from "../../config/embedding.config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

let groqClient = null;

export function getGroqClient() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is required to run AI candidate extraction.");
  }
  if (!groqClient) {
    groqClient = new Groq({
      apiKey: process.env.GROQ_API_KEY,
      timeout: 60000,
      temperature: 0,
      top_p: 1,
    });
  }
  return groqClient;
}

const CACHE_DIR = embeddingConfig.cacheDir;
const CACHE_FILE = embeddingConfig.groqCacheFile;

const warnPipeline = (...args) => {
  if (process.env.DEBUG_PIPELINE === "true") console.warn(...args);
};

function getCache() {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    }
  } catch {}
  return {};
}

function writeCache(cache) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
  } catch {}
}

export function extractFirstJSON(text) {
  if (!text || typeof text !== "string") return null;
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

export function validateCommentaryJSON(data) {
  const errors = [];
  if (!data || typeof data !== "object") {
    errors.push("Root must be an object");
    return { valid: false, errors };
  }
  if (data.summaryText !== undefined && typeof data.summaryText !== "string") {
    errors.push("summaryText must be a string");
  }
  if (!Array.isArray(data.ranking)) {
    errors.push("ranking must be an array");
    return { valid: false, errors };
  }

  const seenNames = new Set();
  data.ranking.forEach((item, index) => {
    if (!item.name || typeof item.name !== "string") {
      errors.push(`Item ${index}: missing or invalid name`);
    }
    if (!item.recommendation || typeof item.recommendation !== "string") {
      errors.push(`Item ${index}: missing or invalid recommendation`);
    }
    if (!Array.isArray(item.reasons)) {
      errors.push(`Item ${index}: reasons must be an array`);
    }
    if (item.name) {
      if (seenNames.has(item.name)) errors.push(`Item ${index}: duplicate name "${item.name}"`);
      seenNames.add(item.name);
    }
  });

  return { valid: errors.length === 0, errors };
}

async function _getChatCompletionRaw({
  model,
  temperature = 0,
  top_p = 1,
  messages,
  cacheKeyPrompt,
}) {
  const cacheEnabled = process.env[embeddingConfig.groqCacheEnabledEnv] === "true";
  const hashSource = cacheKeyPrompt || JSON.stringify({ model, messages });
  const cacheKey = crypto.createHash("sha256").update(hashSource).digest("hex");

  if (cacheEnabled) {
    const cache = getCache();
    if (cache[cacheKey]) {
      const cachedVal = cache[cacheKey];
      return typeof cachedVal === "object" ? JSON.stringify(cachedVal) : cachedVal;
    }
  }

  const response = await getGroqClient().chat.completions.create({
    model,
    temperature,
    top_p,
    messages,
  });

  const raw = response.choices[0].message.content;

  if (cacheEnabled) {
    const cache = getCache();
    try {
      cache[cacheKey] = JSON.parse(raw);
    } catch {
      cache[cacheKey] = raw;
    }
    writeCache(cache);
  }

  return raw;
}

export async function getChatCompletion(params, maxRetries = 5) {
  let backoffMs = 2000;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await _getChatCompletionRaw(params);
    } catch (err) {
      if (err.status === 429 && attempt < maxRetries) {
        warnPipeline(`[Groq Rate Limit] 429 encountered. Retrying in ${backoffMs}ms... (Attempt ${attempt}/${maxRetries})`);
        await new Promise((res) => setTimeout(res, backoffMs));
        backoffMs *= 2;
        continue;
      }
      throw err;
    }
  }
}

export async function getValidatedCommentary(prompt, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const raw = await getChatCompletion({
        model: "llama-3.3-70b-versatile",
        temperature: 0,
        top_p: 1,
        messages: [
          {
            role: "system",
            content:
              "You are a senior technical recruiter. Return ONLY valid JSON matching the strict schema: {\"summaryText\":\"string\",\"ranking\":[{\"name\":\"string\",\"recommendation\":\"string\",\"reasons\":[\"string\"]}]}. No duplicates. No extra keys. Write in direct recruiter voice — specific, human, and concise. Avoid filler phrases like 'the profile shows' or 'based on the CV'.",
          },
          { role: "user", content: prompt },
        ],
        cacheKeyPrompt: prompt,
      });


      const cleaned = extractFirstJSON(raw) || raw;
      const parsed = JSON.parse(cleaned);
      const validation = validateCommentaryJSON(parsed);
      if (!validation.valid) {
        if (attempt === maxRetries) {
          throw new Error(`Failed validation after ${maxRetries} attempts: ${validation.errors.join(", ")}`);
        }
        continue;
      }
      return JSON.stringify(parsed);
    } catch (err) {
      if (attempt === maxRetries) throw err;
    }
  }
}
