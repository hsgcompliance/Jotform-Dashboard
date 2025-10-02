#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

// ---- flags ----
const args = process.argv.slice(2);
const flags = {};
for (const a of args) {
  if (a.startsWith("--")) {
    const [k, v] = a.split("=");
    flags[k.slice(2)] = v ?? true;
  }
}

// Defaults
const ROOT = path.resolve(flags.root ?? process.cwd());
const OUT_DIR = path.resolve(flags.out ?? path.join(ROOT, "out"));

// Ignore lists
const IGNORE_DIRS = new Set([
  "node_modules", ".git", ".next", ".turbo", ".cache", "coverage",
  "dist", "build", ".out", "out"
]);
const IGNORE_FILES = new Set([
  "package-lock.json","yarn.lock","pnpm-lock.yaml","bun.lockb"
]);

async function statSafe(p){ try { return await fs.lstat(p); } catch { return null; } }
const rel = (p)=> path.relative(ROOT, p) || ".";
const skipDirName = (name)=> IGNORE_DIRS.has(name);
const skipFileName = (name)=> IGNORE_FILES.has(name);

async function walk(dir) {
  const st = await statSafe(dir);
  if (!st) return null;

  if (st.isSymbolicLink()) {
    return { name: path.basename(dir), path: rel(dir), type: "symlink" };
  }
  if (st.isFile()) {
    return { name: path.basename(dir), path: rel(dir), type: "file" };
  }

  // Directory
  const name = path.basename(dir);
  if (skipDirName(name)) return null;

  const node = { name, path: rel(dir), type: "dir", children: [] };
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (skipDirName(e.name)) continue;
      const child = await walk(full);
      if (child) node.children.push(child);
    } else if (e.isFile()) {
      if (skipFileName(e.name)) continue;
      node.children.push({ name: e.name, path: rel(full), type: "file" });
    } else if (e.isSymbolicLink()) {
      node.children.push({ name: e.name, path: rel(full), type: "symlink" });
    }
  }
  return node;
}

function toText(node, prefix = "") {
  if (!node || !node.children) return "";
  const ch = node.children.slice()
    .sort((a,b)=> a.type===b.type ? a.name.localeCompare(b.name) : (a.type==="dir"?-1:1));
  const lines = [];
  for (let i = 0; i < ch.length; i++) {
    const last = i === ch.length - 1;
    const branch = last ? "└─ " : "├─ ";
    lines.push(prefix + branch + ch[i].name + (ch[i].type === "dir" ? "/" : ""));
    if (ch[i].type === "dir") lines.push(toText(ch[i], prefix + (last ? "   " : "│  ")));
  }
  return lines.join("\n");
}

(async () => {
  // ensure out dir
  await fs.mkdir(OUT_DIR, { recursive: true });

  // build a single tree rooted at repo
  const rootNode = await walk(ROOT);
  if (!rootNode) {
    console.error("Nothing to walk. Check ROOT:", ROOT);
    process.exit(1);
  }

  // write outputs
  const jsonPath = path.join(OUT_DIR, "file-tree.json");
  const txtPath  = path.join(OUT_DIR, "file-tree.txt");

  await fs.writeFile(jsonPath, JSON.stringify(rootNode, null, 2));
  const header = `${path.basename(ROOT)}/\n`;
  await fs.writeFile(txtPath, header + toText(rootNode));

  console.log(`✓ file tree → ${rel(jsonPath)}, ${rel(txtPath)}`);
  console.log(`ROOT=${ROOT}`);
})();
