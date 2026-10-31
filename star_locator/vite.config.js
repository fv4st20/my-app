import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/star-locator/',
  plugins: [react()],
  server: {
    port: 3000, // Change default port to 3000
    strictPort: false, // This ensures it will automatically pick the next available port if 3000 is taken
  },
})
