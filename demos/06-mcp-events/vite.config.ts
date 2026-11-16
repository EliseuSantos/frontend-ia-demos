import path from 'node:path';
import { defineConfig } from 'vite';

const pages = process.env.GITHUB_PAGES === 'true';

export default defineConfig({
  base: pages ? '/frontend-ia-demos/06-mcp-events/' : '/',
  publicDir: path.resolve(__dirname, '../../packages/theme/public'),
  server: {
    port: 5179,
    fs: { allow: [path.resolve(__dirname, '../..')] },
  },
  build: { target: 'esnext' },
});
