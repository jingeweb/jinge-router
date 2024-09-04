import { defineConfig } from 'vite';
import { jingeVitePlugin } from 'jinge-compiler';

// https://vitejs.dev/config/
export default defineConfig({
   
  build: {
    
  },

  plugins: [
    jingeVitePlugin()
  ],
});
