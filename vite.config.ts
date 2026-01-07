import { defineConfig } from 'vite';
export default defineConfig({
  root: '.',
  base: '',
  build: {
    outDir: 'assets/dist',
    assetsDir: '',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: true,
    cssCodeSplit: false, 
    rollupOptions: {
      input: 'src/admin/main.ts',
      external: ['@wordpress/element'],
      output: {
        entryFileNames: 'main.js',
        format: 'iife',
        inlineDynamicImports: true,
        globals: {
          '@wordpress/element': 'wp.element',
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) return 'style.css';
          return '[name][extname]';
        },
      }
    }
  }
});
