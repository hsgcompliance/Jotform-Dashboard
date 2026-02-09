// components/SubList.js

const HOH_RE = /\b(head\s*of\s*household|household\s*head|hoh)\b/i;
const NAME_RE = /\b(name|full\s*name)\b/i;
const EMAIL_RE = /@/;

function normalizeString(s) {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

function toTitleCase(s) {
  const clean = normalizeString(s).toLowerCase();
  return clean.replace(/\b([a-z])([a-z']*)\b/g, (_, a, b) => a.toUpperCase() + b);
}

function normalizeAnswerValue(v) {
  if (!v) return "";
  if (typeof v === "string" || typeof v === "number") return normalizeString(v);
  if (Array.isArray(v)) return normalizeString(v[0] ?? "");
  if (typeof v === "object") {
    const first = normalizeString(v.first ?? v.firstName ?? v.fname ?? "");
    const last = normalizeString(v.last ?? v.lastName ?? v.lname ?? "");
    if (first || last) return normalizeString(`${first} ${last}`);
    if (v.full) return normalizeString(v.full);
    if (v.answer) return normalizeString(v.answer);
  }
  return "";
}

function looksLikeName(s) {
  const v = normalizeString(s);
  if (!v) return false;
  if (EMAIL_RE.test(v)) return false;
  const parts = v.split(" ").filter(Boolean);
  if (parts.length < 2) return false;
  const letters = v.replace(/[^a-zA-Z]/g, "");
  return letters.length >= 4;
}

export function getSubmissionLabel(sub) {
  const answers = sub?.answers || {};
  const items = Object.values(answers)
    .map((a) => ({
      name: normalizeString(a?.name),
      text: normalizeString(a?.text),
      type: normalizeString(a?.type),
      value: normalizeAnswerValue(a?.answer),
    }))
    .filter((x) => x.value);

  let best = { score: -1, value: "" };

  for (const x of items) {
    const name = (x.name || "").toLowerCase();
    const text = (x.text || "").toLowerCase();

    let score = 0;

    if (HOH_RE.test(x.name) || HOH_RE.test(x.text)) score += 100;
    if (name.includes("customer") && name.includes("name")) score += 90;
    if (name.includes("signer")) score += 80;
    if (NAME_RE.test(x.name) || NAME_RE.test(x.text) || name.endsWith("name")) score += 60;
    if (x.type.includes("control_fullname")) score += 70;

    if (x.value.length > 60) score -= 20;
    if (!looksLikeName(x.value)) score -= 50;

    if (score > best.score) best = { score, value: x.value };
  }

  if (best.score >= 10 && best.value) return toTitleCase(best.value);
  return "";
}

function formatDate(ts) {
  const date = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function shortId(id) {
  const s = String(id || "");
  return s.length > 6 ? s.slice(-6) : s;
}

const styles = {
  list: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  rowBtn: (active) => ({
    width: "100%",
    textAlign: "left",
    background: active ? "rgba(0, 112, 243, 0.10)" : "#fff",
    color: "#111",
    border: active ? "1px solid rgba(0, 112, 243, 0.35)" : "1px solid rgba(0,0,0,0.08)",
    padding: "10px 12px",
    borderRadius: 12,
    fontSize: 13,
    cursor: "pointer",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    boxShadow: active ? "0 1px 8px rgba(0, 112, 243, 0.10)" : "0 1px 6px rgba(0,0,0,0.04)",
    transition: "background 120ms ease, border-color 120ms ease, box-shadow 120ms ease",
  }),
  left: { minWidth: 0, flex: 1 },
  topLine: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  primary: {
    fontWeight: 650,
    fontSize: 13,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  pill: {
    fontSize: 11,
    fontWeight: 650,
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "rgba(0,0,0,0.03)",
    color: "rgba(0,0,0,0.70)",
    flex: "0 0 auto",
  },
  signedPill: {
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid rgba(180, 0, 0, 0.25)",
    background: "rgba(180, 0, 0, 0.06)",
    color: "rgba(140, 0, 0, 0.85)",
    flex: "0 0 auto",
  },
  meta: {
    marginTop: 4,
    fontSize: 11.5,
    color: "rgba(0,0,0,0.62)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  right: {
    flex: "0 0 auto",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 6,
  },
  idChip: {
    fontSize: 11,
    fontWeight: 650,
    padding: "2px 8px",
    borderRadius: 999,
    background: "rgba(0,0,0,0.04)",
    color: "rgba(0,0,0,0.55)",
  },
};

export default function SubList({ subs, selected, onSelect }) {
  return (
    <ul style={styles.list}>
      {subs.map((sub) => {
        const active = selected?.id === sub.id;

        const label = getSubmissionLabel(sub) || `Submission ${shortId(sub.id)}`;
        const time = formatDate(sub.created_at || sub.timestamp);
        const formTitle = sub.form_title || sub.formTitle || "";

        return (
          <li key={sub.id}>
            <button
              onClick={() => onSelect(sub)}
              style={styles.rowBtn(active)}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = "rgba(0,0,0,0.02)";
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = "#fff";
              }}
            >
              <div style={styles.left}>
                <div style={styles.topLine}>
                  <div style={styles.primary} title={label}>
                    {label}
                  </div>

                  {sub.isSign ? (
                    <span style={styles.signedPill}>SIGNED</span>
                  ) : null}
                </div>

                <div style={styles.meta} title={formTitle ? `${formTitle} — ${time}` : time}>
                  {formTitle ? `${formTitle} — ${time}` : time}
                </div>
              </div>

              <div style={styles.right}>
                <span style={styles.idChip} title={String(sub.id)}>
                  #{shortId(sub.id)}
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
