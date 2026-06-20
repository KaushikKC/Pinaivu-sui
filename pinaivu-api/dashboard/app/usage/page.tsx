import { getUsage } from "~/lib/coordinator";
import UsageChart from "./UsageChart";
export const revalidate = 60;
const API_KEY = process.env.DASHBOARD_API_KEY ?? "";

export default async function UsagePage({ searchParams }: { searchParams: { days?: string } }) {
  const days = Math.min(Number(searchParams.days ?? 30), 90);
  const summary = API_KEY ? await getUsage(API_KEY, days).catch(() => null) : null;

  if (!API_KEY) return (<div><h1 className="text-2xl font-semibold text-zinc-100 mb-4">Usage</h1><div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-sm text-amber-300">Set <code className="bg-surface-2 px-1.5 rounded text-xs">DASHBOARD_API_KEY</code> in your environment to view usage.</div></div>);

  return (
    <div>
      <div className="flex items-center justify-between mb-6"><div><h1 className="text-2xl font-semibold text-zinc-100 mb-1">Usage</h1><p className="text-zinc-500 text-sm">Last {days} days</p></div>
        <div className="flex gap-1">{[7,30,90].map(d => (<a key={d} href={`?days=${d}`} className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${days===d ? "bg-accent text-white" : "text-zinc-400 hover:text-white hover:bg-surface-2"}`}>{d}d</a>))}</div></div>
      {summary && (<>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {[["Requests", summary.total_requests.toLocaleString()], ["Input tokens", fmtT(summary.total_input_tokens)], ["Output tokens", fmtT(summary.total_output_tokens)], ["Total cost", `${(summary.total_cost_nanox/1e6).toFixed(4)} X`]].map(([l,v]) => (
            <div key={l} className="bg-surface-1 border border-surface-2/60 rounded-xl px-5 py-4"><p className="text-[11px] text-zinc-500 mb-1.5">{l}</p><p className="text-xl font-semibold text-zinc-100">{v}</p></div>
          ))}
        </div>
        <div className="bg-surface-1 border border-surface-2/60 rounded-xl p-5 mb-8"><p className="text-[11px] text-zinc-500 uppercase tracking-wide mb-4">Requests per day</p><UsageChart records={summary.records} /></div>
        <div className="overflow-x-auto"><table className="w-full text-sm border-collapse"><thead><tr className="border-b border-surface-2 text-left text-zinc-500 text-[11px] uppercase tracking-wide"><th className="pb-3 pr-4">Date</th><th className="pb-3 pr-4">Model</th><th className="pb-3 pr-4">In</th><th className="pb-3 pr-4">Out</th><th className="pb-3 pr-4">Latency</th><th className="pb-3">Cost</th></tr></thead>
          <tbody>{summary.records.slice(0,100).map((r,i) => (<tr key={i} className="border-b border-surface-2/40 hover:bg-surface-1/50"><td className="py-2.5 pr-4 text-zinc-500 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</td><td className="py-2.5 pr-4 font-mono text-indigo-300 text-xs">{r.model}</td><td className="py-2.5 pr-4 text-zinc-400">{r.input_tokens.toLocaleString()}</td><td className="py-2.5 pr-4 text-zinc-400">{r.output_tokens.toLocaleString()}</td><td className="py-2.5 pr-4 text-zinc-500">{r.latency_ms != null ? `${r.latency_ms} ms` : "—"}</td><td className="py-2.5 text-zinc-400">{(r.cost_nanox/1e6).toFixed(6)}</td></tr>))}</tbody></table></div>
      </>)}
      {!summary && <p className="text-zinc-600 text-sm">No usage data for this period.</p>}
    </div>
  );
}
function fmtT(n: number) { if (n>=1e6) return `${(n/1e6).toFixed(1)}M`; if (n>=1e3) return `${(n/1e3).toFixed(1)}K`; return String(n); }
