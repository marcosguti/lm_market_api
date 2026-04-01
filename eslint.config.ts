import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import perfectionist from 'eslint-plugin-perfectionist';
import eslintPluginN from 'eslint-plugin-n';
import path from 'path';
import { fileURLToPath } from 'url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  eslintPluginN.configs['flat/recommended'],
  {
    rules: {
      'n/no-unpublished-import': 'off',
    },
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        project: path.join(dirname, 'tsconfig.json'),
        tsconfigRootDir: dirname,
      },
      sourceType: 'module',
    },
    plugins: {
      '@typescript-eslint': ts,
      n: eslintPluginN,
      perfectionist,
    },
    rules: {
      ...ts.configs.recommended.rules,
      'n/no-missing-import': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      eqeqeq: 'error',
      'no-console': ['error', { allow: ['error'] }],
      'no-constant-condition': ['error', { checkLoops: false }],
      'object-shorthand': ['error', 'always'],
      quotes: [
        'error',
        'single',
        {
          allowTemplateLiterals: false,
          avoidEscape: true,
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['libs/*', 'queries/*', 'types/*'],
              message: 'Use relative imports instead of absolute imports',
            },
          ],
        },
      ],
      ...perfectionist.configs['recommended-alphabetical'].rules,
    },
    settings: {
      node: {
        extensions: ['.js', '.ts'],
        paths: ['src'],
      },
    },
  },
];
