import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
export default defineConfig({
  root: '.',
  base: '',
  resolve: {
    alias: {
      lucide: fileURLToPath(
        new URL('./node_modules/lucide/dist/esm/lucide/src/lucide.js', import.meta.url)
      ),
    },
  },
  build: {
    outDir: 'assets/dist',
    assetsDir: '',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: true,
    cssCodeSplit: false, 
    rollupOptions: {
      input: 'src/admin/main.ts',
      external: ['@wordpress/element', '@wordpress/i18n'],
      output: {
        entryFileNames: 'main.js',
        format: 'iife',
        inlineDynamicImports: true,
        globals: {
          '@wordpress/element': 'wp.element',
          '@wordpress/i18n': 'wp.i18n',
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) return 'style.css';
          return '[name][extname]';
        },
      }
    }
  }
});
