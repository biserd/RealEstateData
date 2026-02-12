import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { getMetaForUrl, injectMetaTags } from "./seoMetaTags";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  app.use("*", async (req, res) => {
    try {
      const indexPath = path.resolve(distPath, "index.html");
      let html = await fs.promises.readFile(indexPath, "utf-8");

      const baseUrl = `https://${req.get("host")}`;
      const meta = await getMetaForUrl(req.originalUrl);
      html = injectMetaTags(html, meta, baseUrl);

      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (e) {
      console.error("[Static] Error serving page:", e);
      res.sendFile(path.resolve(distPath, "index.html"));
    }
  });
}
