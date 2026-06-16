"use client";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

// Professional "Top up" — deposit USDC into your Circle unified balance (Gateway). No kitKey needed.
function getProvider() { const w = window as any; let p = w.okxwallet || w.ethereum; if (w.ethereum?.providers?.length) p = w.ethereum.providers.find((x: any) => x.isMetaMask) || w.ethereum.providers[0]; return p; }
async function adapterOf(p: any) { const { createViemAdapterFromProvider } = await import("@circle-fin/adapter-viem-v2"); return await createViemAdapterFromProvider({ provider: p } as any); }
const fmtA = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function TopUpPanel({ heading, color = "emerald" }: { heading: string; color?: string }) {
  const c = color;
  const { address, isConnected } = useAccount();
  const [bal, setBal] = useState<string | null>(null);
  const [amt, setAmt] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadBal() {
    if (!address) return;
    try { const { createUnifiedBalanceKitContext, getBalances } = await import("@circle-fin/unified-balance-kit"); const ctx = createUnifiedBalanceKitContext(); const r: any = await getBalances(ctx as any, { token: "USDC", sources: { address, chains: ["Arc_Testnet"] }, includePending: true } as any); setBal(r?.totalConfirmedBalance ?? "0"); } catch { }
  }
  useEffect(() => { if (address) loadBal(); }, [address]); // eslint-disable-line

  async function run() {
    if (!address || !(Number(amt) > 0)) return;
    setBusy(true); setStatus("Depositing into your unified balance…");
    try {
      const p = getProvider(); const ad = await adapterOf(p);
      const { createUnifiedBalanceKitContext, deposit } = await import("@circle-fin/unified-balance-kit");
      const r: any = await deposit(createUnifiedBalanceKitContext() as any, { from: { adapter: ad, chain: "Arc_Testnet" }, token: "USDC", amount: amt } as any);
      setStatus("Deposited ✓ " + (r?.txHash ? fmtA(r.txHash) : "") + " — confirming…"); setAmt("");
      for (let i = 0; i < 5; i++) { await new Promise(r => setTimeout(r, 5000)); await loadBal(); }
    } catch (e: any) { setStatus("Deposit: " + (e?.shortMessage || e?.message || "failed").slice(0, 140)); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1"><h3 className="text-base font-bold">{heading}</h3>{bal !== null && <span className={`text-xs px-2.5 py-1 rounded-full bg-${c}-500/15 text-${c}-300`}>Balance ${bal}</span>}</div>
      <div className={`bg-gradient-to-br from-${c}-500/10 to-${c}-500/5 border border-${c}-500/20 rounded-2xl p-5 space-y-3`}>
        <div className="text-xs text-gray-400">Top up your spendable USDC balance — funds become instantly usable across chains.</div>
        <div className="flex items-center gap-3"><span className="text-gray-500 text-xl">$</span><input value={amt} onChange={e => setAmt(e.target.value)} type="number" placeholder="0" className="w-full bg-transparent text-2xl font-bold focus:outline-none placeholder:text-gray-600" /><span className="shrink-0 bg-gray-800 rounded-full px-3 py-1.5 text-sm font-bold flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 grid place-items-center text-[11px] text-white">$</span>USDC</span></div>
      </div>
      <button onClick={run} disabled={!isConnected || busy || !(Number(amt) > 0)} className={`w-full py-4 font-bold text-base rounded-2xl bg-gradient-to-r from-${c}-500 to-${c}-600 text-white hover:opacity-90 disabled:opacity-40 shadow-lg shadow-${c}-500/20`}>{!isConnected ? "Connect wallet" : busy ? "Depositing…" : !(Number(amt) > 0) ? "Enter an amount" : "Deposit USDC"}</button>
      {status && <div className="text-center text-xs text-gray-400">{status}</div>}
      <p className="text-[11px] text-gray-600 text-center">First time approves USDC, then deposits into your Circle unified balance.</p>
    </div>
  );
}
