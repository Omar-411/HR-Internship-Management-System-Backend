import { getEmbedding, cosineSimilarity } from "./services/embedding.service.js";
import { embeddingConfig } from "../config/embedding.config.js";

const warnPipeline = (...args) => {
  if (process.env.DEBUG_PIPELINE === "true") console.warn(...args);
};

/**
 * Embedding Service Facade providing batching and semantic helpers.
 */

/**
 * Retrieves the embedding for a single text.
 * @param {string} text - The input text.
 * @returns {Promise<Array<number>>} The embedding vector.
 */
export async function getSkillOrOccupationEmbedding(text) {
  const meta = await getEmbedding(text);
  return meta.vector;
}

/**
 * Retrieves embeddings for an array of texts in batches.
 * @param {Array<string>} texts - Array of input texts.
 * @param {number} [batchSize=50] - Size of each batch.
 * @param {Function} [progressCallback] - Optional callback function to track progress.
 * @returns {Promise<Array<Array<number>>>} Array of embedding vectors.
 */
export async function getBatchEmbeddings(texts, batchSize = 50, progressCallback = null) {
  const embeddings = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchEmbeds = await Promise.all(
      batch.map(async (text) => {
        try {
          const meta = await getEmbedding(text);
          return meta.vector;
        } catch (err) {
          warnPipeline(`[EMBEDDING FALLBACK] Batch embedding failed; returning deterministic zero vector. ${err.message}`);
          return new Array(embeddingConfig.dimension).fill(0);
        }
      })
    );
    embeddings.push(...batchEmbeds);
    if (progressCallback) {
      progressCallback(Math.min(i + batchSize, texts.length), texts.length);
    }
  }
  return embeddings;
}

/**
 * Calculates the semantic similarity between two texts.
 * @param {string} textA - First text string.
 * @param {string} textB - Second text string.
 * @returns {Promise<number>} Cosine similarity score between 0.0 and 1.0.
 */
export async function semanticSimilarity(textA, textB) {
  if (!textA || !textB) return 0;
  try {
    const embedA = await getSkillOrOccupationEmbedding(textA);
    const embedB = await getSkillOrOccupationEmbedding(textB);
    return cosineSimilarity(embedA, embedB);
  } catch (err) {
    warnPipeline(`[SEMANTIC FALLBACK] semanticSimilarity failed; returning deterministic zero. ${err.message}`);
    return 0;
  }
}

export { cosineSimilarity };
