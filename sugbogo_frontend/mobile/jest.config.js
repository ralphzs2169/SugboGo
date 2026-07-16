/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",

  clearMocks: true,

  testEnvironment: "node",

  testMatch: ["**/*.test.ts", "**/*.test.tsx"],

  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },

  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/index.ts",
  ],
};
