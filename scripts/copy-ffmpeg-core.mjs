/**
 * Copies the ffmpeg.wasm worker + core into `public/ffmpeg-core/` so the
 * browser encodes videos from our own origin (the CSP only allows `self`
 * scripts/workers). Runs on install and before every build; safe to re-run and
 * never fails the build if the optional dependency is missing.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(projectRoot, "public", "ffmpeg-core");
const ffmpegEsm = join(projectRoot, "node_modules", "@ffmpeg", "ffmpeg", "dist", "esm");
const coreEsm = join(projectRoot, "node_modules", "@ffmpeg", "core", "dist", "esm");

try {
  if (!existsSync(ffmpegEsm) || !existsSync(coreEsm)) {
    console.warn("[ffmpeg-core] @ffmpeg/ffmpeg or @ffmpeg/core not installed; skipping copy.");
    process.exit(0);
  }

  mkdirSync(dest, { recursive: true });

  // The worker is an ES module and imports its siblings (`./const.js`,
  // `./errors.js`), so they must sit next to it.
  for (const file of readdirSync(ffmpegEsm)) {
    if (file.endsWith(".js")) {
      copyFileSync(join(ffmpegEsm, file), join(dest, file));
    }
  }

  for (const file of ["ffmpeg-core.js", "ffmpeg-core.wasm"]) {
    copyFileSync(join(coreEsm, file), join(dest, file));
  }

  console.log("[ffmpeg-core] copied worker + core into public/ffmpeg-core/");
} catch (error) {
  console.warn(`[ffmpeg-core] copy skipped: ${error instanceof Error ? error.message : error}`);
}
