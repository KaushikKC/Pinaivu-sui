import { listKeys } from "~/lib/coordinator";
import CreateKeyForm from "./CreateKeyForm";
import RevokeButton from "./RevokeButton";

export const revalidate = 0;

const ACCOUNT_ID = process.env.DASHBOARD_ACCOUNT_ID ?? "";

export default async function KeysPage() {
  const keys = ACCOUNT_ID
    ? await listKeys(ACCOUNT_ID).catch(() => [])
    : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100 mb-1">API Keys</h1>
          <p className="text-zinc-500 text-sm">
            One key works for all models. Pass it as a Bearer token.
          </p>
        </div>
        {ACCOUNT_ID && <CreateKeyForm accountId={ACCOUNT_ID} />}
      </div>

      {!ACCOUNT_ID && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-sm text-amber-300 mb-6">
          Set <code className="bg-surface-2 px-1.5 rounded text-xs">DASHBOARD_ACCOUNT_ID</code> in{" "}
          <code className="bg-surface-2 px-1.5 rounded text-xs">.env.local</code> — or go to{" "}
          <a href="/setup" className="underline hover:text-amber-200">Setup</a> to create one.
        </div>
      )}

      {/* How to use */}
      <div className="bg-surface-1 border border-surface-2/60 rounded-xl px-5 py-4 mb-8">
        <p className="text-[11px] text-zinc-500 uppercase tracking-wide mb-3">How to use</p>
        <pre className="text-[13px] font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap">{`from openai import OpenAI

client = OpenAI(
    base_url="${process.env.COORDINATOR_URL ?? "https://api.pinaivu.com"}/v1",
    api_key="sk-pnv-your-key-here"
)
response = client.chat.completions.create(
    model="qwen-72b",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)`}
        </pre>
      </div>

      {/* Keys table */}
      {keys.length === 0 ? (
        <p className="text-zinc-600 text-sm">No keys yet. Create one above.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-surface-2 text-left text-zinc-500 text-[11px] uppercase tracking-wide">
                <th className="pb-3 pr-6">Key</th>
                <th className="pb-3 pr-6">Name</th>
                <th className="pb-3 pr-6">Created</th>
                <th className="pb-3 pr-6">Last used</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-b border-surface-2/40 hover:bg-surface-1/50 transition-colors">
                  <td className="py-3 pr-6 font-mono text-indigo-300 text-xs">
                    {k.key_prefix}••••••••
                  </td>
                  <td className="py-3 pr-6 text-zinc-300">
                    {k.name ?? <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="py-3 pr-6 text-zinc-500">{fmtDate(k.created_at)}</td>
                  <td className="py-3 pr-6 text-zinc-500">
                    {k.last_used_at
                      ? fmtDate(k.last_used_at)
                      : <span className="text-zinc-700">Never</span>}
                  </td>
                  <td className="py-3">
                    <RevokeButton keyId={k.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}
