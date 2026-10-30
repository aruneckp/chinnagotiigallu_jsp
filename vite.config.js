import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { cpSync, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { createCipheriv, pbkdf2Sync, randomBytes } from "node:crypto";

const ITER = 150000;

// `import("virtual:voters")` returns src/data/voters.json, gzipped and AES-GCM
// encrypted with the sign-in user id and password, so the published site holds
// no readable voter data and no password.
function encryptedVoters(USER, PASS) {
  const ID = "virtual:voters", RID = "\0" + ID;
  const file = resolve("src/data/voters.json");
  return {
    name: "encrypted-voters",
    resolveId: (id) => (id === ID ? RID : null),
    load(id) {
      if (id !== RID) return null;
      this.addWatchFile(file);
      const salt = randomBytes(16), iv = randomBytes(12);
      const key = pbkdf2Sync(`${USER.trim().toLowerCase()}\n${PASS}`, salt, ITER, 32, "sha256");
      const c = createCipheriv("aes-256-gcm", key, iv);
      const ct = Buffer.concat([c.update(gzipSync(readFileSync(file))), c.final(), c.getAuthTag()]);
      const b64 = (b) => b.toString("base64");
      return `export default ${JSON.stringify({ iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) })};`;
    },
  };
}

// Voter photos live in images/ (images/<voter ID>.jpg). The dev server serves
// them from the project folder (a missing one is a 404, not the app page); the
// build copies them to dist/images. The folder is optional: without it the
// pages show initials as before.
function voterPhotos() {
  const dir = resolve("images");
  let outDir = null; // set only for a build: closeBundle also runs when the dev server stops
  return {
    name: "voter-photos",
    configResolved: (c) => { if (c.command === "build") outDir = resolve(c.root, c.build.outDir); },
    configureServer(server) {
      server.middlewares.use("/images", (req, res, next) => {
        const file = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "");
        if (file && !file.includes("..") && existsSync(join(dir, file))) return next();
        res.statusCode = 404;
        res.end();
      });
    },
    closeBundle() {
      if (outDir && existsSync(dir)) cpSync(dir, join(outDir, "images"), { recursive: true });
    },
  };
}

// The sign-in details come from VOTER_USER and VOTER_PASS: a local .env file
// (never committed) or the Environment settings on Render.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VOTER_");
  if (!env.VOTER_USER || !env.VOTER_PASS) {
    throw new Error("Set VOTER_USER and VOTER_PASS in a .env file or the host's environment settings.");
  }
  return {
    plugins: [react(), encryptedVoters(env.VOTER_USER, env.VOTER_PASS), voterPhotos()],
    build: { outDir: "dist", chunkSizeWarningLimit: 1200 },
  };
});
