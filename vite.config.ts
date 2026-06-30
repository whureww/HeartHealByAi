import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
server: {
  proxy: {
    '/api': {
      target: 'http://162.211.183.129:3001',
      changeOrigin: true,
      secure: false,
      ws: true,
      configure: (proxy, options) => {
        proxy.on('error', (err, req, res) => {
          console.log('proxy error', err);
        });
        proxy.on('proxyReq', (proxyReq, req, res) => {
          console.log('Sending Request to the Target:', req.method, req.url);
        });
        proxy.on('proxyRes', (proxyRes, req, res) => {
          console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
        });
      }
    }
  }
}

})
