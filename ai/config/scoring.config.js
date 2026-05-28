export const semanticScoringConfig = {
  minSimilarity: 0.25,
  maxSimilarity: 0.65,
  maxSemanticComponent: 20,
};

export const mismatchPenaltyConfig = {
  domainMismatchScoreMultiplier: 0.2,
  domainMismatchScoreCap: 24,
  seniorityPenaltyMultiplier: 0.9,
};

export const inflationThresholdConfig = {
  keywordSpamMinimumSkills: 5,
  keywordSpamMinimumUniqueRatio: 0.35,
  semanticDominanceRatio: 0.65,
};

export const adjacencyReorderConfig = {
  maxAdjacentScoreDifference: 10,
  minSymbolicDifference: 10,
};
