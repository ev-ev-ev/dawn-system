/**
 * Compiles all compendium packs from src/data/*.json into LevelDB packs.
 * IDs are derived deterministically from type + name so rerunning produces
 * a stable pack (no churn in version control).
 */

import { ClassicLevel } from "classic-level";
import { createHash } from "crypto";
import { readFileSync, rmSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function load(relPath) {
  return JSON.parse(readFileSync(join(root, relPath), "utf8"));
}

function makeId(prefix, key) {
  return createHash("sha1").update(`${prefix}:${key}`).digest("hex").slice(0, 16);
}

async function buildPack(destRelPath, entries, docBuilder) {
  const destDir = join(root, destRelPath);
  rmSync(destDir, { recursive: true, force: true });
  mkdirSync(destDir, { recursive: true });

  const db = new ClassicLevel(destDir, { keyEncoding: "utf8", valueEncoding: "json" });
  const batch = db.batch();

  for (const entry of entries) {
    const doc = docBuilder(entry);
    batch.put(`!items!${doc._id}`, doc);
    console.log(`  ${doc._id}  ${doc.name}`);
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
  } catch { /* compaction is best-effort */ }

  await db.close();
  console.log(`  → ${entries.length} entries → ${destRelPath}\n`);
}

// ─── Techniques ────────────────────────────────────────────────────────────
console.log("Building techniques pack…");
await buildPack("packs/techniques", load("src/data/techniques.json"), (e) => ({
  _id: makeId("technique", `${e.tech}:${e.level}`),
  name: e.name,
  type: "technique",
  img: "icons/svg/book.svg",
  system: {
    tech: e.tech ?? "",
    archetype: e.archetype ?? "",
    tags: e.tags ?? "",
    stars: e.stars ?? "★",
    flavor: e.flavor ?? "",
    level: Number(e.level),
    text: e.text ?? "",
  },
  effects: [], folder: null, sort: 0, ownership: { default: 0 }, flags: {},
}));

// ─── Edges ─────────────────────────────────────────────────────────────────
console.log("Building edges pack…");
await buildPack("packs/edges", load("src/data/edges.json"), (e) => ({
  _id: makeId("edge", e.name),
  name: e.name,
  type: "edge",
  img: "icons/svg/aura.svg",
  system: {
    flavor: e.flavor ?? "",
    defensename: e.defensename ?? "",
    defense: e.defense ?? "",
    turnname: e.turnname ?? "",
    turn: e.turn ?? "",
    phasename: e.phasename ?? "",
    phase: e.phase ?? "",
  },
  effects: [], folder: null, sort: 0, ownership: { default: 0 }, flags: {},
}));

// ─── Components ────────────────────────────────────────────────────────────
console.log("Building components pack…");
await buildPack("packs/components", load("src/data/components.json"), (e) => ({
  _id: makeId("component", e.name),
  name: e.name,
  type: "component",
  img: "icons/svg/mystery-man.svg",
  system: {
    archetype: e.archetype ?? "",
    flavor: e.flavor ?? "",
    basehp: Number(e.basehp) || 0,
    tierhp: Number(e.tierhp) || 0,
    speed: Number(e.speed) || 0,
    tierarmor: Number(e.tierarmor) || 0,
    passive: e.passive ?? "",
    actionname: e.actionname ?? "",
    action: e.action ?? "",
    attackname: e.attackname ?? "",
    attack: e.attack ?? "",
    attackdice: Number(e.attackdice) || 0,
    attacktierdice: Number(e.attacktierdice) || 0,
    attacktensionx: Number(e.attacktensionx) || 0,
    acename: e.acename ?? "",
    acetension: Number(e.acetension) || 0,
    ace: e.ace ?? "",
  },
  effects: [], folder: null, sort: 0, ownership: { default: 0 }, flags: {},
}));

// ─── Modifiers (adversary techniques) ──────────────────────────────────────
console.log("Building modifiers pack…");
await buildPack("packs/modifiers", load("src/data/adversary-techniques.json"), (e) => ({
  _id: makeId("modifier", e.name),
  name: e.name,
  type: "modifier",
  img: "icons/svg/upgrade.svg",
  system: {
    archetype: e.archetype ?? "",
    flavor: e.flavor ?? "",
    basehp: Number(e.basehp) || 0,
    tierhp: Number(e.tierhp) || 0,
    speed: Number(e.speed) || 0,
    baseevasion: Number(e.baseevasion) || 0,
    tierevasion: Number(e.tierevasion) || 0,
    basearmor: Number(e.basearmor) || 0,
    tierarmor: Number(e.tierarmor) || 0,
    passive: e.passive ?? "",
    actionname: e.actionname ?? "",
    action: e.action ?? "",
    attackname: e.attackname ?? "",
    attack: e.attack ?? "",
    attackdice: Number(e.attackdice) || 0,
    attacktierdice: Number(e.attacktierdice) || 0,
    attacktensionx: Number(e.attacktensionx) || 0,
    acename: e.acename ?? "",
    acetension: Number(e.acetension) || 0,
    ace: e.ace ?? "",
  },
  effects: [], folder: null, sort: 0, ownership: { default: 0 }, flags: {},
}));

