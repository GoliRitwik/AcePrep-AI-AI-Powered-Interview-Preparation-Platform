import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,          // always use this port
    strictPort: false,   // if 5173 is taken, use next available (5174, etc)
  }
})
