module.exports = {
  env: {
    node: true,
    es6: true,
  },
  extends: ['eslint:recommended', 'plugin:prettier/recommended'],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'prettier/prettier': 'error',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-unreachable': 'warn',
    'prefer-const': 'warn',
    'no-var': 'warn',
    'no-empty': ['error', { allowEmptyCatch: true }],
    'no-useless-escape': 'warn',
  },
  overrides: [
    {
      files: ['**/scrapers/**/*.js'],
      env: {
        browser: true,
      },
    },
  ],
};
