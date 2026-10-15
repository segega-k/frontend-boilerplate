import js from '@eslint/js';
import betterTailwind from 'eslint-plugin-better-tailwindcss';
import globals from 'globals';
import { join } from 'node:path';
import tseslint from 'typescript-eslint';

const root = import.meta.dirname;

const SPACING_PROPS = '(p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|gap|gap-x|gap-y|space-x|space-y|inset|top|left|right|bottom)';
const SPACING_STEPS = '(0|0\\.5|1|1\\.5|2|3|4|6|8|10|12|16|20|24|px|auto|full)';

const restrictedClasses = [
  { pattern: '\\[', message: 'Arbitrary values are banned: add a token to packages/tokens instead.' },
  { pattern: '\\(--', message: 'Arbitrary CSS variables are banned: map the token in theme.css.' },
  { pattern: '^(.*:)?transition(-all)?$', message: 'Use transition-colors / transition-opacity / transition-transform / transition-presence.' },
  { pattern: '(^|:)dark:', message: 'dark: is banned: themes switch through CSS variables (data-theme).' },
  { pattern: '^(.*:)?(bg-(linear|radial|conic)|from-|via-|to-)', message: 'Gradients are banned by the anti-slop list.' },
  { pattern: '^(.*:)?(backdrop-blur|animate-(pulse|bounce|ping)|uppercase|tracking-widest)', message: 'Banned by the anti-slop list.' },
  { pattern: '^(.*:)?hover:(-?translate-|scale-)', message: 'Hover lift/scale is banned by the anti-slop list.' },
  { pattern: `^(.*:)?-?${SPACING_PROPS}-(?!${SPACING_STEPS}$)\\d`, message: 'Spacing step is not on the token scale.' },
];

const tailwindRules = {
  'better-tailwindcss/no-unknown-classes': 'error',
  'better-tailwindcss/no-conflicting-classes': 'error',
  'better-tailwindcss/no-duplicate-classes': 'error',
  'better-tailwindcss/no-deprecated-classes': 'error',
  'better-tailwindcss/no-restricted-classes': ['error', { restrict: restrictedClasses }],
};

const entryPoints = {
  'packages/ui/**': 'packages/ui/src/styles/kit.css',
  'apps/spa/**': 'apps/spa/src/styles/app.css',
  'apps/astro/**': 'apps/astro/src/styles/site.css',
  'lint-fixtures/**': 'packages/ui/src/styles/kit.css',
};

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/storybook-static/**', '**/.astro/**', '**/generated/**', '**/typetests/**', '**/node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'better-tailwindcss': betterTailwind },
    rules: tailwindRules,
  },
  ...Object.entries(entryPoints).map(([glob, entryPoint]) => ({
    files: [`${glob}/*.{ts,tsx}`, `${glob}`],
    settings: { 'better-tailwindcss': { entryPoint: join(root, entryPoint) } },
  })),
  {
    files: ['**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='className'] > Literal",
          message: 'String className is banned in .tsx: call a tv() recipe from Name.styled.ts.',
        },
        {
          selector: "JSXAttribute[name.name='className'] > JSXExpressionContainer > :matches(Literal, TemplateLiteral, BinaryExpression, ConditionalExpression, LogicalExpression)",
          message: 'className must be a recipe call from Name.styled.ts, not a string expression.',
        },
        {
          selector: "JSXAttribute[name.name='style'] Property[key.value!=/^--/]",
          message: 'style may only pass CSS custom properties (--x) for truly dynamic values.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'tailwind-variants', message: 'tv() lives only in Name.styled.ts.' },
            { name: 'tailwind-merge', message: 'Class merging lives only in Name.styled.ts.' },
            { name: 'clsx', message: 'Class merging lives only in Name.styled.ts.' },
            { name: '@kit/ui/tv', message: 'tv() lives only in Name.styled.ts.' },
          ],
          patterns: [{ group: ['**/styles/tv'], message: 'tv() lives only in Name.styled.ts.' }],
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts'],
    rules: { 'better-tailwindcss/no-conflicting-classes': 'off' },
  },
  {
    files: ['**/*.styled.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/#[0-9a-fA-F]{3,8}\\b|rgba?\\(|hsla?\\(|oklch\\(/]',
          message: 'Raw colours are banned in recipes: use role tokens.',
        },
      ],
    },
  },
);
