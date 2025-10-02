#!/usr/bin/env node
// scripts/samplePayloads.mjs
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

// -------- Env knobs --------
const BASE   = process.env.BASE_URL || "http://localhost:3000";
const OUTDIR = process.env.OUT      || "./samples";
const N      = Number(process.env.LIMIT || 8);             // how many sample items
const SEED   = Number(process.env.SEED  || 42);            // deterministic sampling
const REDACT = process.env.REDACT === "1";                 // redact sensitive text
const ONLY   = (process.env.ONLY || "all").toLowerCase();  // "invoices" | "credit" | "all"
const CC_TRACKER_FORM_ID = process.env.CC_FORM_ID || "251878265158166"; // your old CC form id

// Which normalized fields to highlight side-by-side
const FIELD_LIST = [
  "id","baseId","source","type","createdAt","merchant","amount",
  "expenseType","program","billedTo","customer","card","cardBucket"
];

// Guessed raw-answer provenance for a few fields (tweak to your forms)
const PROVENANCE_HINTS = {
  // credit card slots (example ids)
  merchant:   ["82","182","187","192","197"],
  expenseType:["84","183","188","193","198"],
  customer:   ["156","185","190","195","200"],
  amount:     ["86","107","115","123","131"],
  // invoice-ish (tune these)
  billedTo:   ["31","33"],
  program:    ["31","33"],
};

// -------- Utils --------
async function ensureDir(p) { await fs.mkdir(p, { recursive: true }); }

function withTimeout(promise, ms = 15000, label = "fetch") {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} timeout after ${ms}ms`)), ms)),
  ]);
}

async function fetchJson(url) {
  const res = await withTimeout(fetch(url, { headers: { "Cache-Control": "no-store" } }), 20000, `GET ${url}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

// deterministic pseudo-random
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickMixedDeterministic(items, want = 8, seed = 42, only = "all") {
  const rnd = mulberry32(seed);
  const by = {
    invoice: items.filter(x => String(x.source || "").toLowerCase().includes("invoice")),
    credit:  items.filter(x => String(x.source || "").toLowerCase().includes("credit")),
  };
  const other = items.filter(x => !by.invoice.includes(x) && !by.credit.includes(x));
  const take = (arr, n) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, n);
  };

  if (only === "invoices") return take(by.invoice, want);
  if (only === "credit")   return take(by.credit, want);

  const out = [];
  out.push(...take(by.invoice, Math.min(2, want)));
  out.push(...take(by.credit,  Math.min(2, want)));
  out.push(...take(other, Math.max(0, want - out.length)));
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

function selectRawAnswers(raw, keys) {
  const ans = raw?.answers || {};
  const out = {};
  for (const k of keys) if (ans[k] != null) out[k] = ans[k];
  return out;
}

// Build a side-by-side compare object for a single normalized item
function buildCompare(item) {
  const normalized = {};
  for (const k of FIELD_LIST) normalized[k] = item[k] ?? null;

  const allKeys = new Set([].concat(...Object.values(PROVENANCE_HINTS)));
  const rawSlice = selectRawAnswers(item.raw, [...allKeys]);

  const provenance = {};
  for (const k of FIELD_LIST) {
    if (PROVENANCE_HINTS[k]) {
      provenance[k] = PROVENANCE_HINTS[k].filter(id => rawSlice[id] != null);
    }
  }

  const diff = {};
  for (const k of FIELD_LIST) {
    const v = normalized[k];
    diff[k] = (v === null || v === undefined || v === "") ? "⛔︎ empty" : "✅";
  }

  return {
    meta: {
      id: item.id, baseId: item.baseId, source: item.source, createdAt: item.createdAt
    },
    normalized,
    provenance,       // guessed raw ids that feed each field
    rawAnswersSlice: rawSlice,
    diff
  };
}

// Markdown report
function mdEscape(s) { return String(s ?? "").replace(/\|/g, "\\|"); }

function compareToMarkdown(cmp) {
  const rows = Object.entries(cmp.normalized).map(([k, v]) => {
    const rawIds = (cmp.provenance[k] || []).join(", ");
    const badge = cmp.diff[k] === "✅" ? "✅" : "⛔︎";
    return `| \`${k}\` | ${mdEscape(v)} | ${rawIds || "—"} | ${badge} |`;
  });
  return [
    `### ${cmp.meta.source} – ${cmp.meta.baseId || cmp.meta.id}`,
    `*Created*: ${cmp.meta.createdAt}`,
    ``,
    `| Field | Normalized | Raw IDs (guessed) | Status |`,
    `|---|---|---|---|`,
    ...rows,
    ``,
    `<details><summary>raw.answers slice</summary>`,
    ``,
    "```json",
    JSON.stringify(cmp.rawAnswersSlice, null, 2),
    "```",
    "",
    "</details>",
    ""
  ].join("\n");
}

async function writeReportMarkdown(samples, outdir) {
  const parts = [
    "# Normalization Report",
    `*Base:* ${BASE}  `,
    `*Limit:* ${N}, *Seed:* ${SEED}, *Only:* ${ONLY}, *Redact:* ${REDACT ? "on" : "off"}`,
    ""
  ];
  for (const it of samples) parts.push(compareToMarkdown(buildCompare(it)));
  await fs.writeFile(path.join(outdir, "report.md"), parts.join("\n"));
}

// Simple CSV
function toCsv(rows, cols) {
  const esc = v => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  };
  return [cols.join(","), ...rows.map(r => cols.map(c => esc(r[c])).join(","))].join("\n");
}

// Redaction helpers
function redact(str) {
  if (!str) return str;
  return String(str)
    .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/gi, "[email]")
    .replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, "[card]");
}
function deepRedact(obj) {
  if (Array.isArray(obj)) return obj.map(deepRedact);
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = deepRedact(v);
    return out;
  }
  return typeof obj === "string" ? redact(obj) : obj;
}

// Quick counts
function counts(items) {
  const inv = items.filter((x) => String(x.source || "").toLowerCase().includes("invoice")).length;
  const cc  = items.filter((x) => String(x.source || "").toLowerCase().includes("credit")).length;
  return { invoices: inv, credit: cc, total: items.length };
}

// Field hit stats
function schemaStats(items) {
  const hit = {};
  for (const it of items) {
    for (const k of FIELD_LIST) {
      if (it[k] != null && it[k] !== "") {
        hit[k] = (hit[k] || 0) + 1;
      }
    }
  }
  return hit;
}

// -------- Main --------
async function main() {
  console.log(`[samplePayloads] BASE=${BASE} OUT=${OUTDIR} LIMIT=${N} SEED=${SEED} ONLY=${ONLY} REDACT=${REDACT ? "1" : "0"}`);
  await ensureDir(OUTDIR);

  // Fetch both endpoints
  const [purchases, ccRaw] = await Promise.all([
    fetchJson(`${BASE}/api/purchases`),
    fetchJson(`${BASE}/api/card-tracker?id=${encodeURIComponent(CC_TRACKER_FORM_ID)}`)
  ]);

  let items = purchases.items || [];
  const ccRawItems = ccRaw.items?.slice(0, N) || [];

  if (REDACT) {
    items = deepRedact(items);
  }

  const cts = counts(items);
  const sample = pickMixedDeterministic(items, N, SEED, ONLY);

  // Core outputs
  await fs.writeFile(path.join(OUTDIR, `purchases-sample.json`), JSON.stringify(sample, null, 2), "utf8");
  const summaries = minimalSummaries(sample);
  await fs.writeFile(path.join(OUTDIR, `purchases-sample.summary.json`), JSON.stringify(summaries, null, 2), "utf8");
  if (summaries.length) {
    await fs.writeFile(
      path.join(OUTDIR, `purchases-sample.summary.csv`),
      toCsv(summaries, Object.keys(summaries[0])),
      "utf8"
    );
  }

  // Raw CC snapshot (pre-normalization)
  await fs.writeFile(
    path.join(OUTDIR, `card-tracker-${CC_TRACKER_FORM_ID}.sample.json`),
    JSON.stringify(ccRawItems, null, 2),
    "utf8"
  );

  // Per-item compare JSONs
  for (const it of sample) {
    const cmp = buildCompare(it);
    const safeName = `${(it.source || "item").toString().replace(/\W+/g, "_")}-${(it.baseId || it.id || "unknown").toString().replace(/\W+/g, "_")}.compare.json`;
    await fs.writeFile(path.join(OUTDIR, safeName), JSON.stringify(cmp, null, 2), "utf8");
  }

  // Stats + markdown report
  await fs.writeFile(path.join(OUTDIR, `purchases-sample.stats.json`), JSON.stringify(schemaStats(sample), null, 2), "utf8");
  await writeReportMarkdown(sample, OUTDIR);

  // Tiny console summary
  const firstInv = items.find((x) => String(x.source || "").toLowerCase().includes("invoice"));
  const firstCC  = items.find((x) => String(x.source || "").toLowerCase().includes("credit"));
  const invAnswerKeys = firstInv?.raw?.answers ? Object.keys(firstInv.raw.answers) : [];
  const ccAnswerKeys  = firstCC?.raw?.answers ? Object.keys(firstCC.raw.answers) : [];

  console.log(`\n[ok] wrote:`);
  console.log(` - ${path.join(OUTDIR, 'purchases-sample.json')}`);
  console.log(` - ${path.join(OUTDIR, 'purchases-sample.summary.json')}`);
  console.log(` - ${path.join(OUTDIR, 'purchases-sample.summary.csv')}`);
  console.log(` - ${path.join(OUTDIR, `card-tracker-${CC_TRACKER_FORM_ID}.sample.json`)}`);
  console.log(` - ${path.join(OUTDIR, 'purchases-sample.stats.json')}`);
  console.log(` - ${path.join(OUTDIR, 'report.md')}`);
  console.log(`\nCounts → invoices: ${cts.invoices}, credit-card: ${cts.credit}, total: ${cts.total}`);
  console.log(`Invoice raw.answers keys (first):`, invAnswerKeys.slice(0, 20), invAnswerKeys.length > 20 ? "…" : "");
  console.log(`Credit-card raw.answers keys (first):`, ccAnswerKeys.slice(0, 20), ccAnswerKeys.length > 20 ? "…" : "");
}

main().catch((e) => {
  console.error("[error]", e?.stack || e?.message || e);
  process.exit(1);
});
