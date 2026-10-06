/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/axiolotl/app/*.test.js',
    '<rootDir>/onto-merge/__tests__/*.test.js',
    '<rootDir>/packages/**/__tests__/*.test.js'
  ],
  testPathIgnorePatterns: [
    '/packages/indexeddb-data-management/__tests__/portfolio-management.test.js$',
    '/packages/semantic-workspace/__tests__/semantic-workspace.test.js$'
  ]
};

export default config;
