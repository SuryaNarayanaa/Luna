import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base:"./",
  build:{
    outDir:'dist-react'  // react dist will be stored in dist-react to prevent conflict with electron
  },
  server:{
    port:5123,
    strictPort:true
  }
})
