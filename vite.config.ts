import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

function preloadHomepageRoute(): Plugin {
  return {
    name: "preload-homepage-route",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(_html, context) {
        const landing = Object.values(context.bundle || {}).find((asset) =>
          asset.type === "chunk"
          && asset.facadeModuleId?.replaceAll("\\", "/").endsWith("/client/src/pages/Landing.tsx"),
        );
        if (!landing || landing.type !== "chunk") return;
        return [{
          tag: "link",
          attrs: {
            rel: "modulepreload",
            crossorigin: "",
            href: `/${landing.fileName}`,
            "data-home-route-preload": "",
          },
          injectTo: "head",
        }];
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), preloadHomepageRoute()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 450,
    // Route-level lazy imports provide the useful splitting. Avoid forcing
    // dependency chunks: React-oriented packages can form circular chunk
    // edges and execute before React is initialized in production.
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
