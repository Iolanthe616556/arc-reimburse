"use client";
/* Arc Reimburse — expense reimbursement (escrow). Layout theo ảnh 27 (light/green + charts):
   list claims (approve=release) + bar chart + new claim. Self-contained.
   ABI preserved: create(seller,desc)payable/release(id)/refund(id)/get/total. status 0=Funded 1=Released 2=Refunded. */
import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther, isAddress } from "viem";
const C = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x0") as `0x${string}`;
const CHAIN = 5042002, HEX = "0x4CEF52";
const ABI = [
  { name: "create", type: "function", stateMutability: "payable", inputs: [{ name: "seller", type: "address" }, { name: "desc", type: "string" }], outputs: [{ type: "uint256" }] },
  { name: "release", type: "function", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }], outputs: [] },
  { name: "refund", type: "function", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }], outputs: [] },
  { name: "get", type: "function", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }], outputs: [{ type: "tuple", components: [{ name: "buyer", type: "address" }, { name: "seller", type: "address" }, { name: "desc", type: "string" }, { name: "amount", type: "uint256" }, { name: "status", type: "uint8" }, { name: "at", type: "uint256" }] }] },
  { name: "total", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;
const cut = (a?: string) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
const usd = (w?: bigint) => w === undefined ? "0.00" : Number(formatEther(w)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ST = [{ t: "Awaiting", c: "#b45309", bg: "#fef3c7" }, { t: "Reimbursed", c: "#15803d", bg: "#dcfce7" }, { t: "Rejected", c: "#64748b", bg: "#eef2f6" }];
async function toArc() { const e = (window as any).ethereum; if (!e) return; try { await e.request({ method: "wallet_addEthereumChain", params: [{ chainId: HEX, chainName: "Arc Testnet", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: ["https://rpc.testnet.arc.network"], blockExplorerUrls: ["https://testnet.arcscan.app"] }] }); } catch { try { await e.request({ method: "wallet_switchEthereumChain", params: [{ chainId: HEX }] }); } catch {} } }
const CSS = `
.rb{--bg:#f4f8f5;--card:#fff;--bd:#e1ece5;--bd2:#cfe3d6;--mut:#6c857a;--txt:#13241c;--acc:#059669;--acc2:#047857;min-height:100vh;background:var(--bg);color:var(--txt);font-family:'Inter','Segoe UI',system-ui,sans-serif}
.rb *{box-sizing:border-box}.rb a{color:var(--acc);text-decoration:none}
.rb header{display:flex;align-items:center;gap:10px;padding:15px 6vw;border-bottom:1px solid #e8efe9;background:#fff}
.rb .logo{display:flex;align-items:center;gap:9px;font-weight:800;font-size:16px}
.rb .mark{width:32px;height:32px;border-radius:9px;background:var(--acc);display:grid;place-items:center;font-size:15px}
.rb .chip{font-size:11px;color:var(--mut);border:1px solid var(--bd2);border-radius:99px;padding:3px 10px}
.rb .btn{border:0;border-radius:10px;font:inherit;font-weight:700;cursor:pointer;padding:9px 15px;transition:.15s}.rb .btn:disabled{opacity:.5;cursor:not-allowed}
.rb .pri{background:var(--acc);color:#fff}.rb .pri:hover:not(:disabled){background:var(--acc2)}.rb .gho{background:#fff;color:var(--acc);border:1px solid var(--bd2)}.rb .red{background:#dc2626;color:#fff}
.rb .wrap{max-width:1000px;margin:0 auto;padding:20px 22px 50px}
.rb .stats{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:12px;margin-bottom:16px}
.rb .card{background:#fff;border:1px solid var(--bd);border-radius:16px;padding:16px}
.rb .stat .l{font-size:12px;color:var(--mut)}.rb .stat .v{font-size:24px;font-weight:800;margin-top:3px}
.rb .grid{display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:start}
.rb .row{background:#fff;border:1px solid var(--bd);border-radius:14px;padding:13px 16px;display:flex;align-items:center;gap:12px;margin-bottom:8px}
.rb .ic{width:40px;height:40px;border-radius:10px;background:#ecfdf5;display:grid;place-items:center;font-size:18px}
.rb .pill{font-size:11px;font-weight:700;padding:4px 10px;border-radius:99px}
.rb label{display:block;font-size:12px;color:var(--mut);font-weight:600;margin:8px 0 5px}
.rb input{width:100%;background:var(--bg);border:1px solid var(--bd2);border-radius:10px;padding:11px 13px;font:inherit;font-size:14px;color:var(--txt);outline:none}.rb input:focus{border-color:var(--acc)}
.rb .menu{position:absolute;right:0;top:115%;background:#fff;border:1px solid var(--bd);border-radius:11px;padding:6px;min-width:180px;z-index:30;box-shadow:0 14px 34px rgba(20,60,40,.16)}
.rb .menu button{display:block;width:100%;text-align:left;background:none;border:0;color:var(--txt);font:inherit;font-weight:600;font-size:13px;padding:8px 11px;border-radius:8px;cursor:pointer}.rb .menu button:hover{background:var(--bg)}
@media(max-width:820px){.rb .stats{grid-template-columns:1fr}.rb .grid{grid-template-columns:1fr}}
`;
function Claim({ id, me, busy, write }: { id: bigint; me?: string; busy: boolean; write: (fn: string, args: any[]) => void }) {
  const { data: d } = useReadContract({ address: C, abi: ABI, functionName: "get", args: [id] });
  if (!d) return null; const x = d as any; const st = ST[x.status] || ST[0];
  const isB = me?.toLowerCase() === x.buyer.toLowerCase(); const isS = me?.toLowerCase() === x.seller.toLowerCase();
  return (
    <div className="row">
      <div className="ic">🧾</div>
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{x.desc || `Claim #${id}`}</div><div style={{ fontSize: 11.5, color: "var(--mut)" }}>{cut(x.seller)} · funded by {cut(x.buyer)}</div></div>
      <div style={{ fontWeight: 800 }}>${usd(x.amount)}</div>
      {x.status === 0 ? (isB ? <button className="btn pri" style={{ padding: "7px 13px", fontSize: 12.5 }} disabled={busy} onClick={() => write("release", [id])}>{busy ? "…" : "Approve"}</button> : isS ? <button className="btn gho" style={{ padding: "7px 13px", fontSize: 12.5 }} disabled={busy} onClick={() => write("refund", [id])}>Withdraw</button> : <span className="pill" style={{ background: st.bg, color: st.c }}>{st.t}</span>) : <span className="pill" style={{ background: st.bg, color: st.c }}>{st.t}</span>}
    </div>
  );
}
export default function App() {
  const { address, isConnected } = useAccount(); const net = useChainId();
  const { connectors, connect } = useConnect(); const { disconnect } = useDisconnect();
  const [pop, setPop] = useState(false); const [form, setForm] = useState({ seller: "", desc: "", amount: "" });
  const tx = useWriteContract(); const rcpt = useWaitForTransactionReceipt({ hash: tx.data, query: { enabled: !!tx.data } });
  const busy = tx.isPending || rcpt.isLoading;
  const total = useReadContract({ address: C, abi: ABI, functionName: "total" });
  useEffect(() => { if (rcpt.isSuccess) { tx.reset(); setForm({ seller: "", desc: "", amount: "" }); total.refetch(); } }, [rcpt.isSuccess]); // eslint-disable-line
  const wrong = isConnected && net !== CHAIN; const n = total.data !== undefined ? Number(total.data) : 0;
  const write = (fn: string, args: any[]) => tx.writeContract({ address: C, abi: ABI, functionName: fn as any, args });
  const bars = [40, 62, 48, 70, 55, 80, 66];
  return (
    <div className="rb">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header>
        <div className="logo"><span className="mark">🧾</span>Arc Reimburse</div>
        <span className="chip">Expense reimbursement</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          {wrong && <button className="btn red" onClick={toArc}>Switch to Arc</button>}
          <div style={{ position: "relative" }}><button className="btn pri" onClick={() => setPop(p => !p)}>{isConnected ? cut(address) : "Connect"}</button>
            {pop && <div className="menu">{isConnected ? <button onClick={() => { disconnect(); setPop(false); }} style={{ color: "#dc2626" }}>Disconnect</button> : connectors.map(c => <button key={c.uid} onClick={() => { connect({ connector: c }); setPop(false); }}>{c.name}</button>)}</div>}</div>
        </div>
      </header>
      <div className="wrap">
        <div className="stats">
          <div className="card" style={{ background: "linear-gradient(135deg,#059669,#10b981)", color: "#fff", border: 0 }}>
            <div style={{ fontSize: 12, opacity: .9 }}>Claims this period</div><div style={{ fontSize: 26, fontWeight: 800 }}>{n}</div>
            <svg viewBox="0 0 200 50" style={{ width: "100%", height: 44, marginTop: 6 }}>{bars.map((b, i) => <rect key={i} x={i * 28 + 6} y={50 - b / 2} width="18" height={b / 2} rx="3" fill="rgba(255,255,255,.55)" />)}</svg>
          </div>
          <div className="card stat"><div className="l">Status</div><div className="v" style={{ color: "var(--acc)" }}>escrowed</div></div>
          <div className="card stat"><div className="l">Settle</div><div className="v">USDC</div></div>
        </div>
        <div className="grid">
          <div>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Expense claims</div>
            {n > 0 ? Array.from({ length: n }, (_, i) => BigInt(n - 1 - i)).map(id => <Claim key={id.toString()} id={id} me={address} busy={busy} write={write} />) : <div style={{ color: "var(--mut)", textAlign: "center", padding: "40px 0" }}>No claims yet</div>}
          </div>
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 6 }}>New claim</div>
            <div style={{ fontSize: 12, color: "var(--mut)", marginBottom: 6 }}>Fund a reimbursement to an employee; approve to release.</div>
            <label>Employee address</label><input value={form.seller} onChange={e => setForm(f => ({ ...f, seller: e.target.value }))} placeholder="0x…" style={{ fontFamily: "ui-monospace" }} />
            <label>Expense</label><input value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} placeholder="e.g. Client flight" />
            <label>Amount (USDC)</label><input value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} type="number" placeholder="0.00" style={{ fontSize: 18, fontWeight: 800 }} />
            <button className="btn pri" style={{ width: "100%", marginTop: 14 }} disabled={!isConnected || busy || !isAddress(form.seller) || !(Number(form.amount) > 0)} onClick={() => tx.writeContract({ address: C, abi: ABI, functionName: "create", args: [form.seller as `0x${string}`, form.desc], value: parseEther(form.amount || "0") })}>{busy ? "…" : "Fund claim 🧾"}</button>
          </div>
        </div>
        <div style={{ textAlign: "center", color: "#a7bbb4", fontSize: 12, marginTop: 20 }}>Built on <a href="https://arc.network" target="_blank" rel="noopener noreferrer">Arc Network</a></div>
      </div>
    </div>
  );
}
