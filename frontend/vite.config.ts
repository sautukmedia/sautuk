import { defineConfig, loadEnv } from 'vite'
import { resolveApiUrl } from './src/services/api-config.ts'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'build') resolveApiUrl(loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL, true)
  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
  }
})
