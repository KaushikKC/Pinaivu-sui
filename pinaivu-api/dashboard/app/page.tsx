import { enclaveHealth, listModels } from "~/lib/coordinator";
import { InteractiveTerminal } from "./InteractiveTerminal";

export const revalidate = 30;

export default async function OverviewPage() {
  const [health, models] = await Promise.all([
    enclaveHealth().catch(() => null),
    listModels().catch(() => ({ data: [] })),
  ]);

  const uptime = health ? formatUptime(health.uptime_ms) : "—";
  const baseUrl = "https://api.pinaivu.com";

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <img src="/Pinaivu_logo.jpg" alt="Pinaivu" className="w-10 h-10 rounded-xl" />
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Overview</h1>
          <p className="text-zinc-500 text-sm">Pinaivu coordinator enclave status</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-10">
        <StatCard label="Enclave status" value={health ? "Online" : "Unreachable"} accent={health ? "green" : "red"} />
        <StatCard label="Uptime" value={uptime} />
        <StatCard label="Models live" value={String(models.data.length)} />
        <StatCard label="On-chain ID" value={health?.enclave_object_id ? "Registered" : "Pending"} accent={health?.enclave_object_id ? "green" : "yellow"} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-5">
          <div className="bg-surface-1 border border-surface-2/60 rounded-xl px-5 py-4">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-4">API Details</h3>
            <div className="space-y-3">
              <InfoRow label="Base URL" value={`${baseUrl}/v1`} mono />
              <InfoRow label="Auth" value="Bearer sk-pnv-your-key-here" mono />
              <InfoRow label="Protocol" value="OpenAI-compatible (chat completions)" />
              <InfoRow label="Encryption" value="TLS + TEE enclave attestation" />
              {health?.tls_cert_fingerprint && (
                <div>
                  <p className="text-[11px] text-zinc-500 mb-1">TLS Fingerprint (SHA-256)</p>
                  <p className="font-mono text-[11px] text-indigo-300 bg-surface-2 rounded-lg px-3 py-2 break-all">{health.tls_cert_fingerprint}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-surface-1 border border-surface-2/60 rounded-xl px-5 py-4">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">Available Models</h3>
            {models.data.length === 0 ? (
              <p className="text-zinc-600 text-sm">No nodes connected yet.</p>
            ) : (
              <div className="space-y-2">
                {models.data.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-1.5">
                    <span className="font-mono text-sm text-indigo-300">{m.id}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-zinc-500">{m.nodes_available} node{m.nodes_available !== 1 ? "s" : ""}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <InteractiveTerminal
          baseUrl={baseUrl}
          defaultModel={models.data[0]?.id ?? "gemma4-e4b-128k:latest"}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, accent = "none" }: { label: string; value: string; accent?: "green" | "red" | "yellow" | "none" }) {
  const dot: Record<string, string> = { green: "bg-emerald-400", red: "bg-red-400", yellow: "bg-amber-400", none: "bg-zinc-600" };
  return (
    <div className="bg-surface-1 border border-surface-2/60 rounded-xl px-5 py-4">
      <p className="text-[11px] text-zinc-500 mb-1.5">{label}</p>
      <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${dot[accent]}`} /><span className="text-lg font-semibold text-zinc-100">{value}</span></div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (<div><p className="text-[11px] text-zinc-500 mb-0.5">{label}</p><p className={`text-sm text-zinc-300 ${mono ? "font-mono text-[13px]" : ""}`}>{value}</p></div>);
}

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000); const d = Math.floor(s / 86400); const h = Math.floor((s % 86400) / 3600); const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`; if (h > 0) return `${h}h ${m}m`; return `${m}m`;
}
