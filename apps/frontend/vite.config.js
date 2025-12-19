import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
    },
    build: {
      // Production optimizations
      target: 'es2020',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: true,
        },
      },
      rollupOptions: {
        output: {
          // Code splitting for better caching
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            state: ['zustand', 'axios'],
          },
        },
      },
      // Generate source maps for debugging (not in production)
      sourcemap: mode !== 'production',
      // Chunk size warning threshold
      chunkSizeWarningLimit: 500,
    },
    // Environment variable prefix
    envPrefix: 'VITE_',
  };
});
