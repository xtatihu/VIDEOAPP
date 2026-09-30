import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { downloadsApi } from "./server/downloads-plugin.js";
import { libraryApi } from "./server/library-plugin.js";
import { visitsApi } from "./server/visits-plugin.js";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 4317,
    allowedHosts: true,
  },
  plugins: [downloadsApi(root), libraryApi(root), visitsApi(root)],
});
