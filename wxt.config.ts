import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Bulkframe',
    short_name: 'Bulkframe',
    description:
      'Scan pages, filter images, and download exactly what you need — in a popup, side panel, or full tab.',
    version: '0.1.0',
    icons: {
      16: 'icons/icon16.png',
      32: 'icons/icon32.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
    action: {
      default_title: 'Bulkframe',
      default_icon: {
        16: 'icons/icon16.png',
        32: 'icons/icon32.png',
        48: 'icons/icon48.png',
        128: 'icons/icon128.png',
      },
    },
    permissions: [
      'storage',
      'unlimitedStorage',
      'downloads',
      'scripting',
      'tabs',
      'sidePanel',
      'clipboardWrite',
      'offscreen',
      'activeTab',
    ],
    optional_host_permissions: ['<all_urls>'],
    host_permissions: [],
  },
});
