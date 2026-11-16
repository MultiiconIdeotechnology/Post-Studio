// Quick live check of the image models that have a key in .env. Makes one small image per
// provider (this costs a few cents each) and writes it to MEDIA_DIR/checks/.
// On the server:  docker compose exec app node dist/tools/check-images.js [providerId]
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { getProvider, listProviders } from "../images/index.js";

const PROMPT =
  "A calm, premium Instagram post background for an Indian technology company: deep navy to teal gradient, " +
  "soft abstract network lines, plenty of empty space at the top for a headline. No text, no logos.";

const only = process.argv[2];
const targets = listProviders().filter((p) => p.configured && (!only || p.id === only));
if (!targets.length) {
  console.log(only ? `Provider "${only}" has no key in .env.` : "No image provider has a key in .env.");
  process.exit(1);
}

const dir = path.join(config.MEDIA_DIR, "checks");
await mkdir(dir, { recursive: true });
let failed = 0;
for (const t of targets) {
  const started = Date.now();
  try {
    const [img] = await getProvider(t.id).generate({ prompt: PROMPT, aspect: "4:5", n: 1 });
    const file = path.join(dir, `${t.id}-${Date.now()}.${img.mime.split("/")[1]}`);
    await writeFile(file, img.buffer);
    console.log(`OK    ${t.id}: ${Math.round(img.buffer.length / 1024)} KB in ${((Date.now() - started) / 1000).toFixed(1)}s -> ${file}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${t.id}: ${(e as Error).message}`);
  }
}
process.exit(failed ? 1 : 0);
