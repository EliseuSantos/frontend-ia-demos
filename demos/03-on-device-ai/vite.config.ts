import path from 'node:path';
import { defineConfig } from 'vite';

const pages = process.env.GITHUB_PAGES === 'true';

export default defineConfig({
  base: pages ? '/frontend-ia-demos/03-on-device-ai/' : '/',
  server: {
    port: 5175,
    fs: { allow: [path.resolve(__dirname, '../..')] },
  },
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
  build: { target: 'esnext' },
});
