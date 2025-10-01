// pages/line-items.js
import React from "react";
import useSWR from "swr";
import { Button, TextField, MenuItem } from "@mui/material";

const fetcher = (u) => fetch(u).then((r) => r.json());

const within = (iso, from, to) => {
  const t = new Date(iso).getTime();
  if (from) { const f = new Date(from+"T00:00:00").getTime(); if (t < f) return false; }
  if (to)   { const tt= new Date(to+"T23:59:59").getTime();   if (t > tt) return false; }
  return true;
};

export default function LineItems() {
  const { data, error, isLoading, mutate } = useSWR("/api/purchases", fetcher, { refreshInterval: 300000 });
  const [q, setQ] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [sort, setSort] = React.useState("desc");
  const [openRow, setOpenRow] = React.useState(null);
  const items = data?.items || [];

  const filtered = React.useMemo(() => {
    const txt = q.toLowerCase();
    return items
      .filter(r => within(r.createdAt, from, to))
      .filter(r =>
        !txt ||
        JSON.stringify(r).toLowerCase().includes(txt)
      )
      .sort((a,b)=> sort==="desc"
        ? new Date(b.createdAt) - new Date(a.createdAt)
        : new Date(a.createdAt) - new Date(b.createdAt)
      );
  }, [items, q, from, to, sort]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Line Items</h1>
        <Button size="small" onClick={()=>mutate()}>Reload</Button>
        <TextField size="small" label="Search" value={q} onChange={(e)=>setQ(e.target.value)} />
        <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e)=>setFrom(e.target.value)} />
        <TextField size="small" type="date" label="To"   InputLabelProps={{ shrink: true }} value={to}   onChange={(e)=>setTo(e.target.value)} />
        <TextField size="small" select label="Sort" value={sort} onChange={(e)=>setSort(e.target.value)}>
          <MenuItem value="desc">Newest first</MenuItem>
          <MenuItem value="asc">Oldest first</MenuItem>
        </TextField>
      </div>

      {isLoading && <p>Loading…</p>}
      {error && <p style={{ color: "crimson" }}>Error: {String(error)}</p>}

      <div style={{ overflowX: "auto" }}>
        <table style={{ minWidth: 1100, borderCollapse: "collapse" }}>
          <thead style={{ background: "#f7f7f7" }}>
            <tr>
              <Th>Date</Th>
              <Th>Source</Th>
              <Th>Merchant</Th>
              <Th>Expense Type</Th>
              <Th>Program</Th>
              <Th>Card</Th>
              <Th>Client</Th>
              <Th>Amount</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, idx) => {
              const rowId = `${r.id}-${idx}`;
              const open = openRow === rowId;
              return (
                <React.Fragment key={rowId}>
                  <tr>
                    <Td>{new Date(r.createdAt).toLocaleString()}</Td>
                    <Td>{r.source}</Td>
                    <Td>{r.merchant || "—"}</Td>
                    <Td>{r.expenseType || "—"}</Td>
                    <Td>{r.program || "—"}</Td>
                    <Td>{r.card || "—"}</Td>
                    <Td>{r.customer || "—"}</Td>
                    <Td>${Number(r.amount || 0).toFixed(2)}</Td>
                    <Td>
                      <Button size="small" variant="outlined" onClick={()=>setOpenRow(open ? null : rowId)}>
                        {open ? "Close" : "Open"}
                      </Button>
                    </Td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={9} style={{ background: "#fafafa" }}>
                        <div style={{ display: "grid", gap: 8, padding: 12 }}>
                          <div>
                            <div style={{ fontWeight: 700, marginBottom: 6 }}>Normalized Item JSON</div>
                            <pre style={pre}>{JSON.stringify(r, null, 2)}</pre>
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, marginBottom: 6 }}>Raw Submission JSON</div>
                            <pre style={pre}>{JSON.stringify(r.raw || {}, null, 2)}</pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const Th = ({ children }) =>
  <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #ddd", fontWeight: 600 }}>{children}</th>;
const Td = ({ children }) =>
  <td style={{ padding: "8px 10px", borderBottom: "1px solid #eee", fontSize: 13, verticalAlign: "top" }}>{children}</td>;
const pre = { fontSize: 12, background: "#fff", border: "1px solid #eee", borderRadius: 6, padding: 12, overflow: "auto" };
