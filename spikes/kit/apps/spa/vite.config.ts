import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { defineConfig, type Plugin } from 'vite';

const THEME_SCRIPT = /<script data-theme-init>([\s\S]*?)<\/script>/;

function themeCsp(): Plugin {
  return {
    name: 'theme-init-csp',
    apply: 'build',
    transformIndexHtml(html) {
      const body = THEME_SCRIPT.exec(html)?.[1];
      if (body === undefined) throw new Error('theme init script not found');
      const hash = createHash('sha256').update(body).digest('base64');
      const csp = [
        "default-src 'self'",
        `script-src 'self' 'sha256-${hash}'`,
        "style-src 'self'",
        "font-src 'self'",
        "img-src 'self' data:",
        "base-uri 'none'",
        "form-action 'self'",
      ].join('; ');
      return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), themeCsp()],
});
