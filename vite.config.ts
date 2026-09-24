/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Port fixe : le localStorage est lié à l'origine (donc au port). Changer de port
  // ferait disparaître les prix et les relevés déjà saisis.
  server: { port: 5174, strictPort: true },
  preview: { port: 5174, strictPort: true },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
