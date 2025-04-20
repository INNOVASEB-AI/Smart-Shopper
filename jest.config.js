// jest.config.js
module.exports = {
  // Set the test environment for frontend tests
  testEnvironment: 'jsdom',
  
  // Define test file patterns
  testMatch: [
    '**/tests/**/*.js',
    '**/__tests__/**/*.js',
    '**/*.test.js',
    '**/*.spec.js'
  ],
  
  // Configure coverage reporting
  collectCoverage: true,
  coverageDirectory: './coverage',
  collectCoverageFrom: [
    'js/**/*.js',
    'backend/**/*.js',
    '!**/node_modules/**',
    '!**/vendor/**',
    '!**/tests/**',
    '!**/__tests__/**'
  ],
  
  // Enforce coverage thresholds
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },
  
  // Set up module paths
  moduleDirectories: ['node_modules'],
  
  // Transform files with Babel
  transform: {
    '^.+\\.jsx?$': 'babel-jest'
  },
  
  // Mock files that are not JavaScript
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/tests/mocks/styleMock.js',
    '\\.(gif|ttf|eot|svg|png)$': '<rootDir>/tests/mocks/fileMock.js'
  },
  
  // Setup files to run before tests
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Define projects to run different test configurations
  projects: [
    {
      displayName: 'frontend',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/js/**/*.test.js',
        '<rootDir>/js/**/*.spec.js',
        '<rootDir>/tests/frontend/**/*.js'
      ],
    },
    {
      displayName: 'backend',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/backend/**/*.test.js',
        '<rootDir>/backend/**/*.spec.js',
        '<rootDir>/tests/backend/**/*.js'
      ],
    }
  ]
}; 