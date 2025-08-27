import { defineConfig } from 'vite'
import { resolve } from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const isExtension = mode === 'extension'
  const isPWA = mode === 'pwa'

  const config = {
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    build: {
      rollupOptions: {
        input: isExtension ? {
          popup: resolve(__dirname, 'src/extension/popup.html'),
          options: resolve(__dirname, 'src/extension/options.html'),
          content: resolve(__dirname, 'src/extension/content.ts'),
          background: resolve(__dirname, 'src/extension/background.ts'),
          'popup-script': resolve(__dirname, 'src/extension/popup.ts'),
          'options-script': resolve(__dirname, 'src/extension/options.ts')
        } : isPWA ? {
          main: resolve(__dirname, 'src/pwa/index.html')
        } : {
          main: resolve(__dirname, 'index.html')
        },
        output: isExtension ? {
          entryFileNames: '[name].js',
          chunkFileNames: '[name].js',
          assetFileNames: '[name].[ext]'
        } : undefined
      },
      outDir: isExtension ? 'dist/extension' : isPWA ? 'dist/pwa' : 'dist'
    }
  }

  if (isPWA) {
    config.plugins = [
      VitePWA({
        registerType: 'autoUpdate',
        srcDir: 'src/pwa',
        filename: 'sw.ts',
        strategies: 'injectManifest',
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}']
        },
        manifest: {
          name: 'Prompt Polisher',
          short_name: 'PromptPolisher',
          description: 'Polish your prompts for better AI interactions',
          theme_color: '#4f46e5',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: 'icon-192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'icon-512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ],
          share_target: {
            action: '/share-target',
            method: 'POST',
            enctype: 'multipart/form-data',
            params: {
              title: 'title',
              text: 'text',
              url: 'url'
            }
          }
        }
      })
    ]
  }

  return config
})