export const embeddingConfig = {
  dimension: 384,
  previewSize: 5,
  cacheEnabledEnv: "ENABLE_EMBEDDING_CACHE",
  cacheDir: "./.api-cache",
  cacheFile: "./.api-cache/embedding-cache.json",
  groqCacheEnabledEnv: "ENABLE_GROQ_CACHE",
  groqCacheFile: "./.api-cache/groq-cache.json",
};
