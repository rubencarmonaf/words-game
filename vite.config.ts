import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: './client',
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'client/index.html'),
        privacidad: resolve(__dirname, 'client/privacidad.html'),
        terminos: resolve(__dirname, 'client/terminos.html'),
        avisoLegal: resolve(__dirname, 'client/aviso-legal.html'),
        cookies: resolve(__dirname, 'client/cookies.html'),
        contacto: resolve(__dirname, 'client/contacto.html'),
        gracias: resolve(__dirname, 'client/gracias.html'),
        notFound: resolve(__dirname, 'client/404.html')
      }
    }
  },
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true
      }
    }
  }
});
