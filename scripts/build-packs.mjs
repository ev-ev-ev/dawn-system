/**
 * Converts src/data/techniques.json into a compiled LevelDB compendium pack
 * at packs/techniques using classic-level directly.
 *
 * Each technique entry becomes one Foundry Item document. IDs are derived
 * deterministically from the technique name + level so rerunning the script
 * produces a stable pack (no churn in version control).
 */

import { ClassicLevel } from "classic-level";
import { createHash } from "crypto";
import { readFileSync, rmSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const techniques = JSON.parse(
  readFileSync(join(root, "src/data/techniques.json"), "utf8")
);

const destDir = join(root, "packs/techniques");

// Wipe and recreate so removed entries don't linger.
rmSync(destDir, { recursive: true, force: true });
mkdirSync(destDir, { recursive: true });

const db = new ClassicLevel(destDir, { keyEncoding: "utf8", valueEncoding: "json" });

const batch = db.batch();

for (const entry of techniques) {
  const id = createHash("sha1")
    .update(`${entry.tech}:${entry.level}`)
    .digest("hex")
    .slice(0, 16);

  const key = `!items!${id}`;

  const doc = {
    _id: id,
    name: entry.name,
    type: "technique",
    img: "icons/svg/book.svg",
    system: {
      tech: entry.tech,
      archetype: entry.archetype ?? "",
      tags: entry.tags ?? "",
      stars: entry.stars ?? "★",
      flavor: entry.flavor ?? "",
      level: Number(entry.level),
      text: entry.text ?? "",
    },
    effects: [],
    folder: null,
    sort: 0,
    ownership: { default: 0 },
    flags: {},
  };

  batch.put(key, doc);
  console.log(`Packed ${id} (${entry.name})`);
}

await batch.write();

// Compact so Foundry reads a clean SSTable rather than a raw log.
try {
  const fwd = db.keys({ limit: 1, fillCache: false });
  const firstKey = await fwd.next();
  if (!fwd.idle) await fwd.close();

  const bwd = db.keys({ limit: 1, reverse: true, fillCache: false });
  const lastKey = await bwd.next();
  if (!bwd.idle) await bwd.close();

  if (firstKey && lastKey) await db.compactRange(firstKey, lastKey, { keyEncoding: "utf8" });
} catch {
  // Compaction is a best-effort optimisation; data is safe regardless.
}

await db.close();
console.log(`\nTechniques pack compiled — ${techniques.length} entries.`);
