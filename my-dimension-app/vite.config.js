import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert'

export default defineConfig({
  plugins: [react(), mkcert()], // Add the mkcert plugin
  root: '.', // Ensure Vite looks in the root directory
  server: {
    https: true, // Enable HTTPS
  },
});