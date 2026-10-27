import path from 'node:path';
import { defineConfig } from 'vite';

const pages = process.env.GITHUB_PAGES === 'true';

export default defineConfig({
  base: pages ? '/frontend-ia-demos/02-main-thread/' : '/',
  server: {
    port: 5174,
    fs: { allow: [path.resolve(__dirname, '../..')] },
  },
  build: { target: 'esnext' },
});
