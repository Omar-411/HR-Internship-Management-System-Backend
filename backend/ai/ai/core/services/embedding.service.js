import { pipeline } from "@xenova/transformers";
import fs from "fs";
import crypto from "crypto";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import { embeddingConfig } from "../../config/embedding.config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

let embedder = null;
const CACHE_DIR = embeddingConfig.cacheDir;
const CACHE_FILE = embeddingConfig.cacheFile;

let memoryCache = null;

const EMBEDDING_DIMENSION = embeddingConfig.dimension;
const VECTOR_PREVIEW_SIZE = embeddingConfig.previewSize;

const debugPipeline = (...args) => {
  if (process.env.DEBUG_PIPELINE === "true") console.log(...args);
};

const warnPipeline = (...args) => {
  if (process.env.DEBUG_PIPELINE === "true") console.warn(...args);
};

export class EmbeddingValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "EmbeddingValidationError";
    this.details = details;
  }
}

export function isValidEmbeddingVector(vector) {
  return (
    Array.isArray(vector) &&
    vector.length > 0 &&
    vector.every((value) => typeof value === "number" && Number.isFinite(value))
  );
}

function vectorPreview(vector) {
  if (!Array.isArray(vector)) return [];
  return vector.slice(0, VECTOR_PREVIEW_SIZE).map((value) => Number(value.toFixed(6)));
}

function assertValidEmbeddingVector(vector, context) {
  if (!isValidEmbeddingVector(vector)) {
    throw new EmbeddingValidationError(`[EMBEDDING INVALID] ${context}: vector must be a non-empty numeric array`, {
      context,
      isArray: Array.isArray(vector),
      length: Array.isArray(vector) ? vector.length : null,
    });
  }
  if (vector.length !== EMBEDDING_DIMENSION) {
    warnPipeline(`[EMBEDDING WARN] ${context}: expected dimension ${EMBEDDING_DIMENSION}, got ${vector.length}`);
  }
  return vector;
}

function logEmbeddingValidation({ label, cached, sourceLength, vector }) {
  const dim = Array.isArray(vector) ? vector.length : 0;
  debugPipeline(
    `[EMBEDDING VALID] ${label} | cached=${cached} | sourceLength=${sourceLength} | dim=${dim} | first=${JSON.stringify(vectorPreview(vector))}`
  );
}

function getCache() {
  if (memoryCache) return memoryCache;
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    if (fs.existsSync(CACHE_FILE)) {
      memoryCache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
      return memoryCache;
    }
  } catch {}
  memoryCache = {};
  return memoryCache;
}

function writeCache(cache) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
  } catch {}
}

async function loadEmbedder() {
  if (!embedder) {
    embedder = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
  }
  return embedder;
}

export async function getEmbedding(text) {
  const cacheEnabled = process.env[embeddingConfig.cacheEnabledEnv] === "true";
  const normalizedText = (text || "").toString().trim();
  const label = normalizedText.slice(0, 48).replace(/\s+/g, " ") || "<empty>";
  if (!normalizedText) {
    throw new EmbeddingValidationError("[EMBEDDING INVALID] Refusing to embed empty text", {
      sourceLength: 0,
    });
  }
  const cacheKey = crypto.createHash("sha256").update(normalizedText).digest("hex");

  if (cacheEnabled) {
    const cache = getCache();
    if (Object.prototype.hasOwnProperty.call(cache, cacheKey)) {
      const cachedVector = cache[cacheKey];
      if (!isValidEmbeddingVector(cachedVector)) {
        warnPipeline(`[EMBEDDING CACHE INVALID] key=${cacheKey} label="${label}" length=${Array.isArray(cachedVector) ? cachedVector.length : "non-array"}; regenerating`);
        delete cache[cacheKey];
        writeCache(cache);
      } else {
        assertValidEmbeddingVector(cachedVector, `cache hit ${cacheKey}`);
        logEmbeddingValidation({
          label: `cache hit "${label}"`,
          cached: true,
          sourceLength: normalizedText.length,
          vector: cachedVector,
        });
        return {
          vector: cachedVector,
          cached: true,
          sourceLength: normalizedText.length,
        };
      }
    }
  }

  const model = await loadEmbedder();
  const output = await model(normalizedText, {
    pooling: "mean",
    normalize: true,
  });

  const vector = Array.from(output.data);
  assertValidEmbeddingVector(vector, `generated "${label}"`);
  logEmbeddingValidation({
    label: `generated "${label}"`,
    cached: false,
    sourceLength: normalizedText.length,
    vector,
  });

  if (cacheEnabled) {
    const cache = getCache();
    cache[cacheKey] = vector;
    writeCache(cache);
  }

  return {
    vector,
    cached: false,
    sourceLength: normalizedText.length
  };
}

export function cosineSimilarity(a, b) {
  assertValidEmbeddingVector(a, "cosineSimilarity vector A");
  assertValidEmbeddingVector(b, "cosineSimilarity vector B");
  if (a.length !== b.length) {
    throw new EmbeddingValidationError("[EMBEDDING INVALID] cosineSimilarity dimension mismatch", {
      left: a.length,
      right: b.length,
    });
  }
  const dot = a.reduce((s, v, i) => s + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  if (magA === 0 || magB === 0) {
    throw new EmbeddingValidationError("[EMBEDDING INVALID] cosineSimilarity cannot compare zero-magnitude vectors", {
      leftMagnitude: magA,
      rightMagnitude: magB,
    });
  }
  return dot / (magA * magB || 1);
}
