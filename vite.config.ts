import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this project from https://kavispires.github.io/crazy-race/,
  // so assets must be requested with that path prefix in production builds.
  base: process.env.GITHUB_PAGES ? '/crazy-race/' : '/',
  plugins: [react()],
})
