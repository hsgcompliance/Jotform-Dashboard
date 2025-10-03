// formSchemas.js
// Dictionaries keyed by *Jotform IDs-as-strings* (source of truth).
// Use "order" only for blocking/UX where helpful.

export const CC_SCHEMA = {
  globals: {
    cardChoice:        "33",  // Card being returned (may be blank if workflow bypassed)
    purchaserName:     "55",  // Name
    email:             "56",  // Email address
    returnDateTime:    "28",  // Return date & time (prefilled; buggy sometimes)
    checkoutDateTime:  "101", // Checkout date & time (if present)
    checkoutSummary:   "64",  // Summary HTML
    txnCount:          "93",  // "How many separate transactions..."
    // Files
    uploadAllTxn1:     "70",  // "Upload all" — belongs to Tx1 by position
  },

  // Five explicit transaction blocks. If a later form adds Tx6+, follow this pattern.
  transactions: [
    // Tx1
    {
      merchant: "82",
      expenseType: "84",
      purpose: "85",
      cost: "86",
      supportiveProgram: "169",   // "Supportive Services Program"
      programOperations: null,     // not used when "For a Customer"
      customerName: "156",
      notes: "151",
      files: ["70"],               // Tx1 includes the "Upload all" slot
      flexToggle: "204",           // "Is this YHDP Flex Funds?"
      heading: "98",               // "Transaction 1" (text control; optional)
    },
    // Tx2
    {
      merchant: "182",
      expenseType: "183",
      purpose: "106",
      cost: "107",
      supportiveProgram: "184",
      programOperations: "186",
      customerName: "185",
      notes: "143",
      files: ["109"],
      flexToggle: "205",
      heading: "103",
    },
    // Tx3
    {
      merchant: "187",
      expenseType: "188",
      purpose: "114",
      cost: "115",
      supportiveProgram: "189",
      programOperations: "191",
      customerName: "190",
      notes: "147",
      files: ["117"],
      flexToggle: "206",
      heading: "111",
    },
    // Tx4
    {
      merchant: "192",
      expenseType: "193",
      purpose: "122",
      cost: "123",
      supportiveProgram: "194",
      programOperations: "196",
      customerName: "195",
      notes: null,         // none in current build
      files: ["125"],
      flexToggle: "207",
      heading: "119",
    },
    // Tx5
    {
      merchant: "197",
      expenseType: "198",
      purpose: "130",
      cost: "131",
      supportiveProgram: "199",
      programOperations: "201",
      customerName: "200",
      notes: null,
      files: ["133"],
      flexToggle: "208",
      heading: "127",
    },
  ],

  // Optional anchors (helpful if you ever need to sanity-check "order" for blocking)
  anchors: {
    txHeadings: ["98","103","111","119","127"],
  },
};

export const INVOICE_SCHEMA = {
  globals: {
    invoiceDate:   "31",
    submissionDate:"4",
    purchaser:     "33",
    expenseType:   "34",     // For a Customer | For a Program
    vendor:        "74",
    paymentMethod: "95",
    email:         "25",
    purposeDetail: "75",     // “Expense purpose/detail”
    note:          "111",

    // Customer/recipient
    firstName:     "84",
    lastName:      "85",

    // Service Type (Customer path only); “Other” opens 155
    serviceType:   "53",
    otherService:  "155",

    // Single-cost (when not multi-split)
    costSingle:    "17",

    // Files (typed buckets)
    files: {
      receipt:  "7",   // Upload itemized receipt
      required: "28",  // Chafee/PATH/required docs
      agenda:   "29",  // Training/conference agenda
      w9:       "156", // Youth W-9
    },

    // WIOA-only toggle (appears when a Project includes WIOA)
    wioaScopeWex: "134", // "IS or OS; WEX or Non-Wex"
  },

  // Path A: For a Customer → Program comes from Project (or its "Other")
  customerPath: {
    multiToggle:   "114",
    splitCount:    "115", 
    projects:      ["55","120","121","122","123"],       // Project pickers
    projectOther:  ["154","153","152","151","150"],      // Free-text (use first non-empty)
    amounts:       ["124","125","126","127","128"]
  },

  // Path B: For a Program → Program comes from Bill To (or its "Other")
  programPath: {
    multiToggle:   "114",                       // "Bill to Multiple Grants?"
    splitCount:    "115",                       // “How many Grants…?”
    billToList:    ["112","116","117","118","119"],
    billToOther:   ["149","148","147","146","110"],
    amounts:       ["129","130","131","132","133"],
  },
};

// ---------- tiny helpers ----------

export function getAns(answers, id) {
  const a = answers?.[id];
  return a?.answer ?? a?.prettyFormat ?? "";
}

export function getFiles(answers, ids=[]) {
  const out = [];
  ids.forEach(id => {
    const v = getAns(answers, id);
    if (Array.isArray(v)) out.push(...v);
    else if (v) out.push(v);
  });
  return out;
}

// Credit Card: iterate the N visible transactions (based on 93)
// Falls back to “keep blocks that have a numeric cost”.
export function* iterateCreditCardTxns(answers) {
  const countRaw = String(getAns(answers, CC_SCHEMA.globals.txnCount)).toLowerCase();
  const mapCount = { one:1, two:2, three:3, four:4, five:5 };
  let n = mapCount[Object.keys(mapCount).find(k => countRaw.includes(k))] ?? 5;

  for (let i = 0; i < CC_SCHEMA.transactions.length; i++) {
    if (i >= n) break;
    const t = CC_SCHEMA.transactions[i];

    const cost = getAns(answers, t.cost);
    const amount = Number(String(cost).replace(/[$,]/g,"")) || 0;

    const obj = {
      merchant:          getAns(answers, t.merchant),
      expenseType:       getAns(answers, t.expenseType),
      purpose:           getAns(answers, t.purpose),
      amount,
      supportiveProgram: getAns(answers, t.supportiveProgram),
      programOperations: t.programOperations ? getAns(answers, t.programOperations) : "",
      customer:          getAns(answers, t.customerName),
      notes:             t.notes ? getAns(answers, t.notes) : "",
      files:             getFiles(answers, t.files || []),
      isFlexTxn:         /^y/i.test(String(getAns(answers, t.flexToggle))),
    };

    // Keep blocks that actually have a discernible amount or other core fields
    const hasCore = obj.merchant || obj.expenseType || obj.supportiveProgram || obj.purpose || obj.amount !== 0 || obj.files.length;
    if (hasCore) yield { n: i+1, ...obj };
  }
}

// Invoice: resolve program + splits based on path.
export function resolveInvoice(answers) {
  const expenseType = String(getAns(answers, INVOICE_SCHEMA.globals.expenseType));
  const isCustomerPath = /^for\s+a\s+customer/i.test(expenseType);

  // Files (typed)
  const files_typed = {
    receipt:  getFiles(answers, [INVOICE_SCHEMA.globals.files.receipt]),
    required: getFiles(answers, [INVOICE_SCHEMA.globals.files.required]),
    agenda:   getFiles(answers, [INVOICE_SCHEMA.globals.files.agenda]),
    w9:       getFiles(answers, [INVOICE_SCHEMA.globals.files.w9]),
  };
  files_typed.all = [...files_typed.receipt, ...files_typed.required, ...files_typed.agenda, ...files_typed.w9];

  // Service Type + Flex
  const serviceType   = getAns(answers, INVOICE_SCHEMA.globals.serviceType);
  const otherService  = getAns(answers, INVOICE_SCHEMA.globals.otherService);
  const isFlex = /yhdp\s*flex/i.test(serviceType);

  // Customer name
  const first = getAns(answers, INVOICE_SCHEMA.globals.firstName);
  const last  = getAns(answers, INVOICE_SCHEMA.globals.lastName);
  const customer = [first, last].filter(Boolean).join(" ").trim();

  // WIOA scope/wex (only meaningful if a Project contains WIOA — caller can decide)
  const wioaScopeWex = String(getAns(answers, INVOICE_SCHEMA.globals.wioaScopeWex));
  let serviceScope = "", wex = "";
  if (wioaScopeWex) {
    const s = wioaScopeWex.toUpperCase();
    serviceScope = s.includes("IS") ? "IS" : s.includes("OS") ? "OS" : "";
    wex = s.includes("WEX") ? "WEX" : s.includes("NON-WEX") ? "Non-WEX" : "";
  }

  // Path A: For a Customer → Program from Project (or Project Other)
  if (isCustomerPath) {
    const project = INVOICE_SCHEMA.customerPath.projects
      .map(id => getAns(answers, id))
      .find(v => v) || "";
    const projOther = INVOICE_SCHEMA.customerPath.projectOther
      .map(id => getAns(answers, id))
      .find(v => v) || "";
    const program = projOther || project || "";

    return {
      path: "customer",
      program,
      project,
      projectOther: projOther,
      customer,
      files_typed,
      serviceType,
      otherService,
      isFlex,
      serviceScope,
      wex,
      splits: null, // single amount path (use costSingle)
    };
  }

  // Path B: For a Program → Program from Bill To (or Bill To Other)
  const multi = /^y/i.test(String(getAns(answers, INVOICE_SCHEMA.programPath.multiToggle)));
  const billTo = INVOICE_SCHEMA.programPath.billToList.map(id => getAns(answers, id));
  const billToOther = INVOICE_SCHEMA.programPath.billToOther.map(id => getAns(answers, id));
  const amounts = INVOICE_SCHEMA.programPath.amounts.map(id => {
    const v = getAns(answers, id);
    return Number(String(v).replace(/[$,]/g,"")) || 0;
  });

  // Pair in order; ignore empty rows
  const splits = [];
  const maxN = Math.max(billTo.length, amounts.length);
  for (let i = 0; i < maxN; i++) {
    const bt = billTo[i] || "";
    const other = billToOther[i] || "";
    const label = (bt && !/other/i.test(bt)) ? bt : (other || "");
    const amt = amounts[i] || 0;
    if (!label && !amt) continue;
    splits.push({ billedTo: label, amount: amt, program: label });
  }

  // Single path (multi==No) still comes through with 1 effective target
  return {
    path: "program",
    program: splits[0]?.program || "",
    project: "",
    projectOther: "",
    customer: "",
    files_typed,
    serviceType,
    otherService,
    isFlex,
    serviceScope,
    wex,
    splits,
  };
}
