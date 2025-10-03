import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Optimize JSX runtime for production
      jsxRuntime: 'automatic'
    })
  ],
  
  // Development server optimizations
  server: {
    hmr: true, // Hot module replacement for fast development
    port: 5173
  },
  
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    
    // Enable source maps only for debugging (can be disabled for production)
    sourcemap: false,
    
    // Optimize for industrial monitoring: smaller chunks, better caching
    chunkSizeWarningLimit: 500, // Stricter limit for better performance
    
    // Target modern browsers for better performance
    target: 'esnext',
    
    // Enable minification for smaller bundles
    minify: 'esbuild',
    
    rollupOptions: {
      output: {
        // Optimized chunking strategy for industrial applications
        manualChunks: (id) => {
          // Core React libraries
          if (id.includes('react') || id.includes('react-dom')) {
            return 'react-core';
          }
          
          // Chart libraries (heavy, rarely changes)
          if (id.includes('recharts') || id.includes('d3-')) {
            return 'charts';
          }
          
          // State management and HTTP client
          if (id.includes('zustand') || id.includes('axios')) {
            return 'data-management';
          }
          
          // Node modules (vendor code)
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          
          // Our application code
          return 'app';
        },
        
        // Optimize asset names for better caching
        assetFileNames: (assetInfo) => {
          if (!assetInfo.name) return `assets/[name]-[hash][extname]`;
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `images/[name]-[hash][extname]`;
          }
          if (/css/i.test(ext)) {
            return `styles/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js'
      },
      
      // External dependencies that should not be bundled
      external: []
    },
    
    // Optimization for better compression
    assetsInlineLimit: 4096, // Inline small assets as base64
    
    // CSS optimizations
    cssCodeSplit: true, // Split CSS for better caching
    
    // Report compressed size
    reportCompressedSize: true
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'zustand',
      'axios',
      'recharts'
    ],
    // Force optimization of these packages
    force: false
  },
  
  // Define global constants for better tree shaking
  define: {
    __DEV__: 'import.meta.env.DEV',
    __PROD__: 'import.meta.env.PROD'
  }
})
