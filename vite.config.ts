import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  base: "/DecompilingFutureCrew/",
  build: {
    target: "es2022",
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        glenz: resolve(__dirname, "glenz/index.html"),
        dots: resolve(__dirname, "dots/index.html"),
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
