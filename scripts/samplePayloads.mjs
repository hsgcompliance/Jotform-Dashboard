#!/usr/bin/env node
// scripts/samplePayloads.mjs
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUTDIR = process.env.OUT || "./samples";
const N = Number(process.env.LIMIT || 8); // total sample items (mixed)

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

function ensureDir(p) {
  return fs.mkdir(p, { recursive: true });
}

function pickMixed(items, want = 8) {
  const inv = items.filter((x) => (x.source || "").toLowerCase().includes("invoice"));
  const cc  = items.filter((x) => (x.source || "").toLowerCase().includes("credit"));
  const other = items.filter((x) => !inv.includes(x) && !cc.includes(x));
  const out = [];
  // at least 2 of each if available
  out.push(...inv.slice(0, Math.min(2, want)));
  out.push(...cc.slice(0, Math.min(2, want)));
  // fill remainder, keeping raw.answers intact
  const pool = items.filter((x) => !out.includes(x));
  out.push(...pool.slice(0, Math.max(0, want - out.length)));
  return out;
}

function minimalSummaries(items) {
  return items.map((r) => ({
    id: r.id,
    baseId: r.baseId,
    source: r.source,
    type: r.type,
    createdAt: r.createdAt,
    merchant: r.merchant,
    program: r.program,
    expenseType: r.expenseType,
    billedTo: r.billedTo,
    customer: r.customer,
    card: r.card,
    cardBucket: r.cardBucket,
    amount: r.amount,
  }));
}

async function main() {
  await ensureDir(OUTDIR);

  // 1) Unified purchases (mixed CC + Invoice), newest first
  const purchases = await fetchJson(`${BASE}/api/purchases`);
  const items = purchases.items || [];
  const sample = pickMixed(items, N);

  await fs.writeFile(
    path.join(OUTDIR, `purchases-sample.json`),
    JSON.stringify(sample, null, 2),
    "utf8"
  );
  await fs.writeFile(
    path.join(OUTDIR, `purchases-sample.summary.json`),
    JSON.stringify(minimalSummaries(sample), null, 2),
    "utf8"
  );

  // 2) Raw credit-card tracker (old form) flattened items
  //    (Keep as-is so we can compare mapper output)
  const cc = await fetchJson(`${BASE}/api/card-tracker?id=251878265158166`);
  await fs.writeFile(
    path.join(OUTDIR, `card-tracker-251878265158166.sample.json`),
    JSON.stringify(cc.items?.slice(0, N) || [], null, 2),
    "utf8"
  );

  // 3) Tiny console report
  const invCount = items.filter((x) => (x.source || "").includes("invoice")).length;
  const ccCount  = items.filter((x) => (x.source || "").includes("credit")).length;

  // Print the keys present in raw.answers for first invoice + first cc (debug)
  const firstInv = items.find((x) => (x.source || "").includes("invoice"));
  const firstCC  = items.find((x) => (x.source || "").includes("credit"));
  const invAnswerKeys = firstInv?.raw?.answers ? Object.keys(firstInv.raw.answers) : [];
  const ccAnswerKeys  = firstCC?.raw?.answers ? Object.keys(firstCC.raw.answers) : [];

  console.log(`\n[ok] wrote:`);
  console.log(` - ${path.join(OUTDIR, 'purchases-sample.json')}`);
  console.log(` - ${path.join(OUTDIR, 'purchases-sample.summary.json')}`);
  console.log(` - ${path.join(OUTDIR, 'card-tracker-251878265158166.sample.json')}`);
  console.log(`\nCounts → invoices: ${invCount}, credit-card: ${ccCount}, total: ${items.length}`);
  console.log(`Invoice raw.answers keys (first):`, invAnswerKeys.slice(0, 20), invAnswerKeys.length > 20 ? "…" : "");
  console.log(`Credit-card raw.answers keys (first):`, ccAnswerKeys.slice(0, 20), ccAnswerKeys.length > 20 ? "…" : "");
}

main().catch((e) => {
  console.error("[error]", e?.message || e);
  process.exit(1);
});
