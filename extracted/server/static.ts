import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  const downloadsPath = path.resolve(distPath, "downloads");
  app.use("/downloads", express.static(downloadsPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.tar.gz') || filePath.endsWith('.gz')) {
        res.setHeader('Content-Type', 'application/gzip');
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
      }
    }
  }));

  const assetsPath = path.resolve(distPath, "assets");
  app.use("/assets", express.static(assetsPath, {
    maxAge: '1y',
    immutable: true,
    etag: false,
    lastModified: false,
  }));

  app.use(express.static(distPath, {
    maxAge: '1h',
    etag: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    },
  }));

  app.use("/{*path}", (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
