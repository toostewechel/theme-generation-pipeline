import { defineConfig, type Plugin } from "vite";
import { resolve } from "path";
import { writeFileSync } from "fs";

const projectRoot = resolve(__dirname, "../..");

function saveThemePlugin(): Plugin {
  return {
    name: "save-theme",
    configureServer(server) {
      server.middlewares.use("/__save-theme", (req, res) => {
        if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
        let body = "";
        req.on("data", (c) => (body += c));
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
      });
    },
  };
}

export default defineConfig({
  root: ".",
  plugins: [saveThemePlugin()],
  resolve: { alias: { "@project": projectRoot } },
  server: { open: true, fs: { allow: [projectRoot] } },
});
