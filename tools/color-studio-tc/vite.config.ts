import { defineConfig, type Plugin } from "vite";
import { resolve } from "path";
import { writeFileSync } from "fs";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const projectRoot = resolve(__dirname, "../..");

function saveThemePlugin(): Plugin {
  const handler = (req: any, res: any, next: () => void) => {
    if (!req.url || !req.url.startsWith("/__save-theme")) return next();
    if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
    let body = "";
    req.on("data", (c: Buffer) => (body += c));
    req.on("end", () => {
      try {
        writeFileSync(resolve(projectRoot, "theme.config.ts"), body, "utf-8");
        res.statusCode = 200;
        res.end("ok");
      } catch (e) {
        res.statusCode = 500;
        res.end(String(e));
      }
    });
  };
  return {
    name: "save-theme",
    // Register on BOTH dev and preview servers so Save works whether the app is
    // run via `vite` (dev) or `vite preview` (built).
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  root: ".",
  plugins: [react(), tailwindcss(), saveThemePlugin()],
  resolve: {
    alias: {
      "@project": projectRoot,
      "@ui": resolve(__dirname, "src/ui/index.ts"),
      "@ui/": resolve(__dirname, "src/ui/"),
    },
  },
  server: { open: true, fs: { allow: [projectRoot] } },
});
