import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `npm run dev`        -> http://localhost:5180 (camera + GPS work on localhost)
// `npm run dev:https`  -> https://<your-LAN-IP>:5180 so a phone on the same Wi-Fi can scan and use GPS
//                         (browsers only allow camera/location on HTTPS or localhost).
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'https' ? [basicSsl()] : [])],
  server: {
    host: mode === 'https' ? true : 'localhost',
    port: 5180,
    strictPort: true, // fail loudly instead of silently moving to another port
    proxy: {
      '/api': { target: 'http://localhost:4100', changeOrigin: true },
    },
  },
}));
