import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendTarget = env.VITE_BACKEND_URL || env.BACKEND_URL || 'http://127.0.0.1:8000'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
        },
        '/reviews': {
          target: backendTarget,
          changeOrigin: true,
        },
        '/review': {
          target: backendTarget,
          changeOrigin: true,
        },
        '/rules': {
          target: backendTarget,
          changeOrigin: true,
        },
        '/facts': {
          target: backendTarget,
          changeOrigin: true,
        },
        '/health': {
          target: backendTarget,
          changeOrigin: true,
        },
        '/brand-guidelines': {
          target: backendTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
