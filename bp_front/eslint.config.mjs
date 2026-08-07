import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
    // `npm run lint` is `eslint .`, and flat config does NOT read .gitignore — so every
    // gitignored output directory has to be listed here or ESLint walks it.
    {
        ignores: [
            'dist',
            'src/__generated__',
            'test-results',
            'playwright-report',
            'blob-report',
            'playwright/.cache',
            'e2e/.auth',
        ]
    },
  {
      files: ['**/*.{ts,tsx}'],
      extends: [
          js.configs.recommended,
          ...tseslint.configs.recommended,
          reactHooks.configs.flat.recommended,
          reactRefresh.configs.vite,
      ],
      languageOptions: {
          ecmaVersion: 2022,
          globals: globals.browser,
    },
  },
  {
      name: 'bp/e2e-playwright',
      files: ['e2e/**/*.ts', 'playwright.config.ts'],
      languageOptions: {
          // Declared for accuracy, not to fix an error: spec bodies are Node and
          // page.evaluate() callbacks are DOM, so both sets belong here. No rule
          // currently reads them (no-undef is off for TS via tseslint's
          // eslint-recommended), so removing this changes no lint outcome today —
          // it becomes load-bearing the moment no-undef or a typed preset is on.
          // Globals MERGE key-by-key rather than replacing, so both sets survive.
          globals: {...globals.node, ...globals.browser},
      },
      rules: {
          'react-refresh/only-export-components': 'off',
      },
  },
)
