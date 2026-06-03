module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.js$": "babel-jest",
  },
  transformIgnorePatterns: [
    "/node_modules/(?!node-fetch)/" // Allow node-fetch through Babel
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/ai/"
  ],
};