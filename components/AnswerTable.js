import { useMemo, useState } from "react";
import PDFButton from "./PDFButton";

/* ---------- helpers ---------- */
const isUrl = (s) => typeof s === "string" && /^https?:\/\//.test(s);

const stripHtml = (s) =>
  String(s || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const isEmptyAnswer = (ans) => {
  if (ans == null) return true;

  if (typeof ans === "string") return ans.trim() === "";

  if (Array.isArray(ans)) return ans.length === 0 || ans.every(isEmptyAnswer);

  if (typeof ans === "object") {
    const keys = Object.keys(ans);
    if (keys.length === 0) return true;
    return keys.every((k) => isEmptyAnswer(ans[k]));
  }

  return false;
};

const shortTail = (url, max = 44) => {
  const tail = String(url).split("/").pop() || String(url);
  return tail.length > max ? `${tail.slice(0, max)}…` : tail;
};

const typeOf = (a) => String(a?.type || "");
const isHeader = (a) => typeOf(a) === "control_head";
const isDivider = (a) => typeOf(a) === "control_divider";
const isPageBreak = (a) => typeOf(a) === "control_pagebreak";

function getOrderNumber(a, fallbackIdx) {
  const n = Number(a?.order);
  return Number.isFinite(n) ? n : 100000 + fallbackIdx;
}

/* ---------- HTML-ish prettyFormat renderer (NO dangerouslySetInnerHTML) ---------- */
function renderHtmlishString(s) {
  const raw = String(s || "");
  // Split on <br> lines
  const lines = raw.split(/<br\s*\/?>/i).map((x) => x.trim()).filter(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {lines.map((line, i) => {
        // If the line is an anchor, render it as a link
        const m = line.match(/<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
        if (m) {
          const href = m[1];
          const text = stripHtml(m[2]) || shortTail(href);
          return (
            <div key={i}>
              <a href={href} target="_blank" rel="noreferrer">
                {text}
              </a>
            </div>
          );
        }

        const txt = stripHtml(line);
        if (!txt) return null;
        return <div key={i}>{txt}</div>;
      })}
    </div>
  );
}

/* ---------- choose the best display answer per field type ---------- */
function selectDisplayAnswer(a) {
  const t = typeOf(a);

  // These prettyFormat values are usually HTML → prefer structured answer.
  if (t === "control_fileupload") return a?.answer ?? [];
  if (t === "control_address") return a?.answer ?? null;

  // These are already clean
  if (t === "control_phone") return a?.answer?.full ?? a?.answer ?? "";
  if (t === "control_email") return a?.answer ?? "";

  // Datetimes: prettyFormat is human-readable and usually not HTML
  if (t === "control_datetime") return a?.prettyFormat ?? a?.answer?.datetime ?? a?.answer ?? "";

  // Fullname: build from object if possible
  if (t === "control_fullname") {
    const v = a?.answer;
    if (v && typeof v === "object") {
      const first = String(v.first ?? v.firstName ?? "").trim();
      const last = String(v.last ?? v.lastName ?? "").trim();
      const full = `${first} ${last}`.trim();
      return full || a?.prettyFormat || "";
    }
    return a?.prettyFormat ?? a?.answer ?? "";
  }

  // Default: prefer prettyFormat unless it’s empty, then answer
  return a?.prettyFormat ?? a?.answer ?? "";
}

/* ---------- render answer cell ---------- */
const renderCell = (ans) => {
  if (isEmptyAnswer(ans)) return null;

  // Address object → format nicely (NOT the <br> prettyFormat)
  if (typeof ans === "object" && !Array.isArray(ans)) {
    const looksLikeAddress =
      "addr_line1" in ans || "city" in ans || "state" in ans || "postal" in ans;

    if (looksLikeAddress) {
      const line1 = String(ans.addr_line1 || "").trim();
      const line2 = String(ans.addr_line2 || "").trim();
      const city = String(ans.city || "").trim();
      const state = String(ans.state || "").trim();
      const zip = String(ans.postal || "").trim();

      const cityLine = [city, state].filter(Boolean).join(", ");
      const lastLine = [cityLine, zip].filter(Boolean).join(" ");

      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {line1 && <div>{line1}</div>}
          {line2 && <div>{line2}</div>}
          {lastLine && <div>{lastLine}</div>}
        </div>
      );
    }

    // Generic object/table
    return (
      <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
        <tbody>
          {Object.entries(ans)
            .filter(([_, v]) => !isEmptyAnswer(v))
            .map(([k, v]) => (
              <tr key={k}>
                <td style={{ border: "1px solid rgba(0,0,0,0.16)", padding: 6, fontWeight: 650 }}>
                  {stripHtml(k)}
                </td>
                <td style={{ border: "1px solid rgba(0,0,0,0.16)", padding: 6 }}>
                  {typeof v === "string" && /<[^>]+>/.test(v) ? renderHtmlishString(v) : String(v)}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    );
  }

  // HTML-ish string (prettyFormat sometimes leaks through for odd controls)
  if (typeof ans === "string" && /<[^>]+>/.test(ans)) {
    // Special case: if it’s literally a URL wrapped in an <a>, renderHtmlishString handles it
    return renderHtmlishString(ans);
  }

  // Plain string
  if (typeof ans === "string") {
    return isUrl(ans) ? (
      <a href={ans} target="_blank" rel="noreferrer">
        {shortTail(ans)}
      </a>
    ) : (
      ans
    );
  }

  // Array (URLs or text)
  if (Array.isArray(ans)) {
    if (ans.length === 0) return null;

    return ans.map((item, idx) => {
      const tail = idx < ans.length - 1 ? ", " : "";
      if (isUrl(item)) {
        return (
          <span key={idx}>
            <a href={item} target="_blank" rel="noreferrer">
              {shortTail(item)}
            </a>
            {tail}
          </span>
        );
      }
      return (
        <span key={idx}>
          {String(item)}
          {tail}
        </span>
      );
    });
  }

  return String(ans);
};

export default function AnswerTable({ answers = {}, subId = "", sub = null }) {
  const [showRaw, setShowRaw] = useState(false);

  const ordered = useMemo(() => {
    const vals = Object.values(answers || {});
    return vals
      .map((a, idx) => ({
        a,
        idx,
        order: getOrderNumber(a, idx),
        type: typeOf(a),
        question: stripHtml(a?.text || a?.name || ""),
        ans: selectDisplayAnswer(a),
        pdfUrl: a?.pdf?.download_url || a?.answer?.download_url,
      }))
      .sort((x, y) => (x.order - y.order) || (x.idx - y.idx));
  }, [answers]);

  const rows = useMemo(() => {
    return ordered
      .map((x) => {
        if (isHeader(x.a)) {
          const txt = stripHtml(x.a?.text);
          if (!txt) return null;
          return { kind: "header", key: `h-${x.idx}`, text: txt };
        }

        if (isDivider(x.a)) return { kind: "divider", key: `d-${x.idx}` };

        if (isPageBreak(x.a)) return { kind: "pagebreak", key: `p-${x.idx}` };

        const hasPdf = !!x.pdfUrl;
        const hasAns = !isEmptyAnswer(x.ans);

        // Hide blank Q/A lines unless there’s a PDF button.
        if (!hasAns && !hasPdf) return null;

        return {
          kind: "qa",
          key: `q-${x.idx}`,
          question: x.question,
          ans: x.ans,
          pdfUrl: x.pdfUrl,
          idx: x.idx,
        };
      })
      .filter(Boolean);
  }, [ordered]);

  const rawObj = sub || { id: subId, answers };

  if (showRaw) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={() => setShowRaw(false)}
            style={{
              border: "1px solid rgba(0,0,0,0.16)",
              background: "#fff",
              padding: "6px 10px",
              borderRadius: 10,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 650,
            }}
          >
            Show formatted
          </button>
        </div>

        <pre
          style={{
            margin: 0,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.08)",
            background: "rgba(0,0,0,0.02)",
            overflow: "auto",
            fontSize: 12,
            lineHeight: 1.4,
          }}
        >
          {JSON.stringify(rawObj, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => setShowRaw(true)}
          style={{
            border: "1px solid rgba(0,0,0,0.16)",
            background: "#fff",
            padding: "6px 10px",
            borderRadius: 10,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 650,
          }}
        >
          Show raw
        </button>
      </div>

      {rows.map((r) => {
        if (r.kind === "header") {
          return (
            <div key={r.key} style={{ padding: "8px 2px 4px 2px" }}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  letterSpacing: 0.2,
                  color: "rgba(0,0,0,0.82)",
                }}
              >
                {r.text}
              </div>
              <div style={{ height: 1, background: "rgba(0,0,0,0.10)", marginTop: 10 }} />
            </div>
          );
        }

        if (r.kind === "divider") {
          return (
            <div
              key={r.key}
              style={{
                height: 1,
                background: "rgba(0,0,0,0.08)",
                margin: "8px 0",
              }}
            />
          );
        }

        if (r.kind === "pagebreak") {
          return (
            <div key={r.key} style={{ margin: "10px 0" }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "rgba(0,0,0,0.45)",
                  textTransform: "uppercase",
                  letterSpacing: 0.7,
                }}
              >
                Page break
              </div>
              <div style={{ height: 1, background: "rgba(0,0,0,0.08)", marginTop: 8 }} />
            </div>
          );
        }

        return (
          <div
            key={r.key}
            style={{
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 12,
              padding: "10px 12px",
              background: "#fff",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>
              {r.question}
            </div>

            <div style={{ fontSize: 13, color: "rgba(0,0,0,0.78)" }}>
              {renderCell(r.ans)}
            </div>

            {r.pdfUrl && (
              <div style={{ marginTop: 8 }}>
                <PDFButton url={r.pdfUrl} name={`${subId || "file"}-${r.idx}`} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
