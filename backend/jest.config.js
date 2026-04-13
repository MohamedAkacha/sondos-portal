module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js'],
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: ['/node_modules/', '/tests/fixtures/'],
  setupFilesAfterSetup: ['<rootDir>/tests/setup.js'],
  testTimeout: 15000,
};
