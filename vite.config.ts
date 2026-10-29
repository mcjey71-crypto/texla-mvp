import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], cacheDir: process.env.TEXLA_VITE_CACHE || 'node_modules/.vite', optimizeDeps: { include: ['mammoth','pdfjs-dist','tesseract.js','marked','fflate','mathlive'] } });
