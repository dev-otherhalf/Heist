import { defineConfig } from "vite";
import shopify from "vite-plugin-shopify";

export default defineConfig({
  build: {
    emptyOutDir: false,
    rollupOptions: {
      output: {
        entryFileNames: "vite-[name]-[hash].js",
        chunkFileNames: "vite-[name]-[hash].js",
        assetFileNames: "vite-[name]-[hash][extname]",
      },
    },
  },
  plugins: [
    shopify({
      sourceCodeDir: "src",
      entrypointsDir: "src/entrypoints",
      themeHotReload: true,
    }),
  ],
});
