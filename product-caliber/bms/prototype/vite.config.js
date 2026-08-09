import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({ resolvers: [ElementPlusResolver()], dts: false }),
    Components({ resolvers: [ElementPlusResolver()], dts: false }),
  ],
  build: {
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/vue') || id.includes('node_modules/@vue') || id.includes('node_modules/vue-router')) return 'vue-core'
          if (id.includes('node_modules/@element-plus/icons-vue')) return 'element-icons'
          if (id.includes('node_modules/element-plus')) return 'element-plus'
          if (id.includes('node_modules/dexie')) return 'storage'
        },
      },
    },
  },
  server: {
    port: 10520,
  },
  preview: {
    port: 10520,
  },
})
