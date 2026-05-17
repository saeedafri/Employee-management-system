module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'no-console': 'error',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    quotes: ['error', 'single'],
    semi: ['error', 'always'],
    'comma-dangle': ['error', 'always-multiline'],
    indent: ['error', 2],
  },
  overrides: [
    {
      files: ['tests/**/*.js'],
      env: {
        mocha: true,
      },
      globals: {
        describe: 'readonly',
        it: 'readonly',
        before: 'readonly',
        beforeEach: 'readonly',
        after: 'readonly',
        afterEach: 'readonly',
      },
    },
  ],
};
