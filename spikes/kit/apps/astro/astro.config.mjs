import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  integrations: [react()],
  security: { csp: true },
  vite: {
    plugins: [tailwindcss()],
  },
});
