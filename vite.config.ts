import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // GitHub Pages project-site base path. Change if repository name changes.
  base: process.env.GITHUB_ACTIONS === 'true' ? '/ParkSRM/' : '/',
  build: { sourcemap: true },
})
