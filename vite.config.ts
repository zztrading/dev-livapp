import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
// PWA DESABILITADO temporariamente para evitar cache stale

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __BUILD_FINGERPRINT__: JSON.stringify(
      `${new Date().toISOString().slice(0, 10)}-${Date.now().toString(36).slice(-5)}`
    ),
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(), 
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  optimizeDeps: {
    include: ["react", "react-dom", "@tanstack/react-query"],
  },
  build: {
    manifest: true,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return;
          // Three.js + react-three + postprocessing — isolado, só carrega quando uma página 3D for usada
          if (
            id.includes("/three/") ||
            id.includes("@react-three") ||
            id.includes("postprocessing") ||
            id.includes("/three-stdlib/")
          ) return "three";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("prismjs") || id.includes("react-syntax-highlighter")) return "prism";
          if (id.includes("lucide-react")) return "icons";
          // ⛔ NÃO isolar react/react-dom/scheduler/react-query/react-router em chunks separados.
          // Causa TypeError: Cannot read properties of undefined (reading 'useSyncExternalStore')
          // em produção por ordem de inicialização de chunks ESM irmãos.
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
}));
