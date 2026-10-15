export const primitives = {
  pine50: '#eef6f3',
  pine500: '#1f6f5c',
  pine600: '#185a4a',
  pine300: '#5fbfa3',
  pine200: '#8fd4bf',
  sand0: '#ffffff',
  sand50: '#f7f6f3',
  sand100: '#efede8',
  sand200: '#e3e0d8',
  sand400: '#a8a397',
  sand600: '#6b675d',
  sand900: '#1d1c19',
  ink950: '#121311',
  ink900: '#1b1d1a',
  ink800: '#252823',
  ink700: '#30342e',
  ink500: '#5a6056',
  ink300: '#a3aa9e',
  ink50: '#eef0ec',
  red500: '#c2412d',
  red600: '#a63522',
  red300: '#f08a77',
  red200: '#f5a898',
  amber400: '#f2b33d',
} as const;

type Primitive = keyof typeof primitives;

export const roles = {
  light: {
    bg: 'sand50',
    'surface-1': 'sand0',
    'surface-2': 'sand100',
    'surface-3': 'sand200',
    fg: 'sand900',
    'fg-muted': 'sand600',
    border: 'sand200',
    'border-strong': 'sand400',
    accent: 'pine500',
    'accent-hover': 'pine600',
    'on-accent': 'sand0',
    'accent-soft': 'pine50',
    danger: 'red500',
    'danger-hover': 'red600',
    'on-danger': 'sand0',
    focus: 'amber400',
  },
  dark: {
    bg: 'ink950',
    'surface-1': 'ink900',
    'surface-2': 'ink800',
    'surface-3': 'ink700',
    fg: 'ink50',
    'fg-muted': 'ink300',
    border: 'ink700',
    'border-strong': 'ink500',
    accent: 'pine300',
    'accent-hover': 'pine200',
    'on-accent': 'ink950',
    'accent-soft': 'ink800',
    danger: 'red300',
    'danger-hover': 'red200',
    'on-danger': 'ink950',
    focus: 'amber400',
  },
} as const satisfies Record<'light' | 'dark', Record<string, Primitive>>;

export const font = {
  sans: "'Onest Variable', 'Onest', ui-sans-serif, sans-serif",
} as const;

export const text = {
  'label-sm': { size: '13px', lineHeight: '16px', weight: '500' },
  'label-md': { size: '15px', lineHeight: '20px', weight: '500' },
  'label-lg': { size: '17px', lineHeight: '24px', weight: '500' },
  'body-md': { size: '16px', lineHeight: '24px', weight: '400' },
  'title-md': { size: '20px', lineHeight: '28px', weight: '600' },
  'title-lg': { size: '28px', lineHeight: '34px', weight: '650' },
} as const;

export const spacing = {
  base: '4px',
  'control-sm': '32px',
  'control-md': '40px',
  'control-lg': '48px',
} as const;

export const container = {
  dialog: '420px',
  page: '720px',
} as const;

export const radius = {
  control: '10px',
  surface: '16px',
  pill: '999px',
} as const;

export const shadow = {
  overlay: '0 12px 32px rgb(0 0 0 / 0.18), 0 2px 6px rgb(0 0 0 / 0.08)',
} as const;

export const motion = {
  'duration-fast': '120ms',
  'duration-base': '200ms',
  'duration-screen': '220ms',
  'ease-standard': 'cubic-bezier(0.2, 0, 0, 1)',
  'ease-exit': 'cubic-bezier(0.3, 0, 1, 1)',
} as const;

export const opacity = {
  disabled: '0.45',
  scrim: '0.48',
} as const;
