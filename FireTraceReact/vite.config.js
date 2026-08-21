import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    // trycloudflare assigns a new random subdomain on every run, so allow the
    // whole domain rather than pinning one hostname. The leading dot matches
    // any subdomain.
    allowedHosts: ['.trycloudflare.com'],
  },
})
