import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const clientDirectory = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {'@shared': path.resolve(clientDirectory, '../shared/src')},
  },
  server: {
    proxy: {
      '/api': {target: 'http://localhost:3001'},
      '/socket.io': {target: 'http://localhost:3001', ws: true},
    },
  },
  build: {outDir: 'dist'},
});
