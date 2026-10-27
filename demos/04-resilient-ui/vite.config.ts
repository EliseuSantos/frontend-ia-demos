import path from 'node:path';
import { defineConfig } from 'vite';
import { mockStreamPlugin } from './server/plugin';

const pages = process.env.GITHUB_PAGES === 'true';

export default defineConfig({
  base: pages ? '/frontend-ia-demos/04-resilient-ui/' : '/',
  publicDir: path.resolve(__dirname, '../../packages/theme/public'),
  plugins: [mockStreamPlugin()],
  server: {
    port: 5176,
    fs: { allow: [path.resolve(__dirname, '../..')] },
  },
  build: { target: 'esnext' },
});
