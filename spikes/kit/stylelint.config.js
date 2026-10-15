const BANNED_FONTS =
  '/\\b(Inter|Roboto|Open Sans|Lato|Montserrat|Poppins|Space Grotesk|Space Mono|DM Sans|DM Serif|Plus Jakarta Sans|Outfit|Syne|Instrument (Sans|Serif)|Fraunces|Playfair Display|Cormorant|Lora|Newsreader|Bricolage Grotesque)\\b/i';

export default {
  extends: ['stylelint-config-standard'],
  plugins: ['stylelint-value-no-unknown-custom-properties'],
  ignoreFiles: ['**/dist/**', '**/node_modules/**', '**/storybook-static/**'],
  rules: {
    'at-rule-no-unknown': [
      true,
      { ignoreAtRules: ['theme', 'source', 'utility', 'custom-variant', 'variant', 'apply', 'reference', 'slot', 'view-transition'] },
    ],
    'at-rule-no-deprecated': [true, { ignoreAtRules: ['apply'] }],
    'import-notation': 'string',
    'custom-property-pattern': null,
    'selector-pseudo-element-no-unknown': [true, { ignorePseudoElements: ['view-transition-old', 'view-transition-new', 'view-transition-group'] }],
    'declaration-no-important': null,
    'color-no-hex': true,
    'color-named': 'never',
    'function-disallowed-list': ['rgb', 'rgba', 'hsl', 'hsla', 'oklch'],
    'declaration-property-value-disallowed-list': {
      transition: ['/\\ball\\b/'],
      'transition-property': ['all'],
      'font-family': [BANNED_FONTS],
    },
    'declaration-property-value-no-unknown': null,
    'csstools/value-no-unknown-custom-properties': [
      true,
      { importFrom: ['packages/tokens/src/generated/tokens.css', 'packages/tokens/src/generated/theme.css'] },
    ],
  },
  overrides: [
    {
      files: ['packages/tokens/src/generated/**/*.css'],
      rules: {
        'color-no-hex': null,
        'function-disallowed-list': null,
        'color-hex-length': null,
        'alpha-value-notation': null,
        'custom-property-empty-line-before': null,
      },
    },
  ],
};
