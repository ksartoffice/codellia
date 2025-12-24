import { defineConfig } from 'vite';
export default defineConfig({
  root: '.',
  base: '',
  build: {
    outDir: 'assets/dist',
    assetsDir: '',
    emptyOutDir: true,
    target: 'es2020',
    rollupOptions: { input: 'src/admin/main.ts' }
  }
});