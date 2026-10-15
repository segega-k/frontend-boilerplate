import type { Decorator, Preview } from '@storybook/react-vite';
import '../src/styles/kit.css';

const withThemeAndDir: Decorator = (Story, context) => {
  const root = document.documentElement;
  root.dataset.theme = context.globals.theme === 'dark' ? 'dark' : 'light';
  root.dir = context.globals.dir === 'rtl' ? 'rtl' : 'ltr';
  return <Story />;
};

const preview: Preview = {
  decorators: [withThemeAndDir],
  globalTypes: {
    theme: {
      description: 'Theme (sets data-theme on <html>)',
      toolbar: { icon: 'mirror', items: ['light', 'dark'], dynamicTitle: true },
    },
    dir: {
      description: 'Text direction',
      toolbar: { icon: 'transfer', items: ['ltr', 'rtl'], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: 'light', dir: 'ltr' },
  parameters: {
    layout: 'padded',
    a11y: { test: 'error' },
  },
};

export default preview;
