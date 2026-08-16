import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import js from '@eslint/js';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importPlugin from 'eslint-plugin-import-x';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import prettierPlugin from 'eslint-plugin-prettier';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactRefreshPlugin from 'eslint-plugin-react-refresh';
import securityPlugin from 'eslint-plugin-security';
import storybookPlugin from 'eslint-plugin-storybook';
import unusedImportsPlugin from 'eslint-plugin-unused-imports';
import globals from 'globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default [
  {
    ignores: [
      'node_modules/**/*',
      'public/assets/models/draco/**',
      'coverage/**',
      'reports/**',
      'dist/**',
      'dist-ssr/**',
      'storybook-static/**',
      '.tanstack/**',
      '**/*.cjs',
      // Generated, not source.
      'src/i18n/messages/*.ts', // lingui compile
      'src/routeTree.gen.ts',
      '**/*.d.ts'
    ]
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2020,
        ...globals.node,
        React: 'readonly', // for React.* types (ReactNode, RefObject...)
        NodeJS: 'readonly',
        __APP_VERSION__: 'readonly'
      },
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: true,
        tsconfigRootDir: __dirname
      }
    },
    settings: {
      react: { version: 'detect' },
      // Lets import-x follow the @/* alias, for no-unresolved and the internal group of order.
      'import-x/resolver-next': [createTypeScriptImportResolver({ project: './tsconfig.json' })]
    },
    plugins: {
      'import-x': importPlugin,
      'jsx-a11y': jsxA11yPlugin,
      prettier: prettierPlugin,
      security: securityPlugin,
      'unused-imports': unusedImportsPlugin,
      '@typescript-eslint': typescriptPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'react-refresh': reactRefreshPlugin
    },
    rules: {
      'no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
      ],
      'sort-imports': [
        'error',
        {
          ignoreCase: false,
          ignoreDeclarationSort: true,
          ignoreMemberSort: false,
          memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
          allowSeparatedGroups: true
        }
      ],
      'import-x/no-unresolved': 'error',
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['sibling', 'parent'], 'index', 'unknown'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true }
        }
      ],
      'react/jsx-sort-props': [
        'warn',
        {
          ignoreCase: false,
          callbacksLast: true,
          shorthandFirst: true,
          noSortAlphabetically: false,
          multiline: 'last',
          reservedFirst: true
        }
      ],
      // App code logs through utils/logger. Warn and not error so a scratch log survives a
      // feature branch; --max-warnings 0 on the shared branches makes it blocking there.
      'no-console': 'warn',
      'prettier/prettier': 'error',
      'max-len': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/naming-convention': 'off',
      '@typescript-eslint/ban-types': 'off',
      'react/no-unescaped-entities': 'error',
      'react/jsx-key': 'error',
      'react/jsx-no-target-blank': 'error',
      'react/no-children-prop': 'error',
      'react/no-danger-with-children': 'error',
      'react/no-deprecated': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      ...jsxA11yPlugin.flatConfigs.recommended.rules,
      ...securityPlugin.configs.recommended.rules,
      // detect-object-injection fires on every arr[i] in a frame loop, and the fs-filename one
      // only ever matches scripts building paths out of constants.
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-fs-filename': 'off'
    }
  },
  {
    // Fast Refresh only swaps a module in place if it exports components and nothing else.
    files: ['src/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }]
    }
  },
  {
    // File-based routing needs a Route export beside the component, so every route file would
    // warn forever. Editing one reloads the page instead of hot-swapping it, that's the
    // documented cost of the convention.
    files: ['src/routes/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' }
  },
  {
    // Build tooling, outside the TypeScript program: `project: true` makes the parser demand a
    // tsconfig that lists the file, and none does. No type-aware rule is enabled here anyway.
    files: ['**/*.mjs'],
    languageOptions: { parserOptions: { project: false } }
  },
  {
    // Scripts are CLIs, their output is the interface.
    files: ['scripts/**/*.{js,mjs}', 'initialize.js', '*.config.{ts,mjs}'],
    rules: { 'no-console': 'off' }
  },
  {
    // The rule is about user input reaching a regex engine, which never happens in a unit test.
    files: ['tests/**/*.{ts,tsx}'],
    rules: { 'security/detect-non-literal-regexp': 'off' }
  },
  {
    // Only place allowed to name `console`.
    files: ['src/utils/logger/**/*.{ts,tsx}'],
    rules: { 'no-console': 'off' }
  },
  {
    // Tests and tooling report to the terminal, not through the app logger.
    files: ['tests/**/*.{ts,tsx}', 'e2e/**/*.{ts,tsx}'],
    rules: { 'no-console': ['warn', { allow: ['info', 'warn', 'error'] }] }
  },
  ...storybookPlugin.configs['flat/recommended']
];
