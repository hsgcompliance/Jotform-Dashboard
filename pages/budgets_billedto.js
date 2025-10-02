import React from "react";
import useSWR from "swr";
import { Chip, IconButton, Menu, MenuItem, Button } from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";

const fetcher = (u) => fetch(u).then((r) => r.json());

function groupByBillTo(items) {
  const roll = {};
  for (const r of items) {
    if ((r.source || "").toLowerCase() !== "invoice") continue;     // invoices only
    const bill = (r.billedTo || r.program || "UNKNOWN").trim();
    roll[bill] = roll[bill] || { spent: 0, rows: [] };
    roll[bill].spent += Number(r.amount || 0);
    roll[bill].rows.push(r);
  }
  return roll;
}

const Th = ({ children }) =>
  <th style={{ textAlign: "left", padding: "8px 9px", borderBottom: "1px solid #e5e9f0", fontWeight: 700, background: "#f6f8fb" }}>{children}</th>;
const Td = ({ children }) =>
  <td style={{ padding: "7px 9px", borderBottom: "1px solid #f0f2f5", fontSize: 13, whiteSpace: "nowrap" }}>{children}</td>;

export default function BudgetsByBilledTo() {
  const { data, error, isLoading, mutate } = useSWR("/api/purchases", fetcher, { refreshInterval: 300000 });
  const items = data?.items || [];
  const roll = React.useMemo(() => groupByBillTo(items), [items]);

  const [menu, setMenu] = React.useState(null);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h1 style={{ margin: 0 }}>Budgets • Bill To view</h1>
        <Chip size="small" label="Invoices only" sx={{ bgcolor: "#eef5ff" }} />
        <Button size="small" onClick={() => mutate()}>Reload</Button>
        <IconButton onClick={(e) => setMenu(e.currentTarget)}>
          <MoreVertIcon />
        </IconButton>
        <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
          <MenuItem onClick={() => { setMenu(null); window.location.href = "/budgets"; }}>Open main Budgets</MenuItem>
        </Menu>
      </div>

      {isLoading && <p>Loading…</p>}
      {error && <p style={{ color: "crimson" }}>Error: {String(error)}</p>}

      {Object.entries(roll)
        .sort(([,a],[,b])=> b.spent - a.spent)
        .map(([bill, g]) => (
          <section key={bill} style={{ border: "1px solid #e6e6e6", borderRadius: 16, background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow:"hidden", marginBottom: 18 }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: 20, flex: 1 }}>{bill}</h3>
              <div style={{ fontSize: 13, opacity: 0.8 }}>Spent: <b>${g.spent.toFixed(2)}</b></div>
            </div>
            <div style={{ overflowX: "auto", padding: "0 10px 10px" }}>
              <table style={{ minWidth: 1000, borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <Th>Date</Th><Th>Vendor</Th><Th>Program (bucket)</Th><Th>Descriptor</Th><Th>Customer</Th><Th>Amount</Th><Th>Type</Th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt)).map((r,i)=>(
                    <tr key={`${r.id}-${i}`}>
                      <Td>{new Date(r.createdAt).toLocaleString()}</Td>
                      <Td title={r.merchant || ""}>{r.merchant || "—"}</Td>
                      <Td>{r.program || "—"}</Td>
                      <Td>{r.descriptor || r.serviceType || "—"}</Td>
                      <Td>{r.customer || "—"}</Td>
                      <Td>${Number(r.amount||0).toFixed(2)}</Td>
                      <Td>{r.type || (r.source === "invoice" ? "Invoice" : r.source || "—")}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
    </div>
  );
}
