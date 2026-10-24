import { defineConfig, loadEnv } from 'vite'
import { netlifyApiRedirects, resolveApiUrl } from './src/services/api-config.ts'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const apiUrl = loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL
  if (command === 'build') resolveApiUrl(apiUrl, true)
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'netlify-auth-proxy',
        apply: 'build',
        generateBundle() {
          this.emitFile({ type: 'asset', fileName: '_redirects', source: netlifyApiRedirects(apiUrl) })
        },
      },
    ],
  }
})
