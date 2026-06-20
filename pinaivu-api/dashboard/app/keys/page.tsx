'use client';

import { useState, useEffect, useCallback } from 'react';
import { SessionManager } from '~/lib/zklogin/session';
import CreateKeyForm from './CreateKeyForm';
import RevokeButton from './RevokeButton';

interface ApiKey { id: string; key_prefix: string; name: string | null; created_at: string; last_used_at: string | null; }

export default function KeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadKeys = useCallback(async () => {
    const proof = SessionManager.getProof();
    if (!proof) { setLoading(false); return; }
    try {
      const accRes = await fetch('/api/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: proof.email, wallet_addr: proof.address }) });
      if (!accRes.ok) { setError(`Account setup failed: ${await accRes.text()}`); setLoading(false); return; }
      const acc = await accRes.json();
      if (acc.error) { setError(`Account error: ${acc.error}`); setLoading(false); return; }
      setAccountId(acc.id);
      const keysRes = await fetch(`/api/keys?account_id=${acc.id}`);
      if (keysRes.ok) setKeys(await keysRes.json());
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-semibold text-zinc-100 mb-1">API Keys</h1><p className="text-zinc-500 text-sm">One key works for all models. Pass it as a Bearer token.</p></div>
        {accountId && <CreateKeyForm accountId={accountId} onCreated={loadKeys} />}
      </div>
      <div className="bg-surface-1 border border-surface-2/60 rounded-xl px-5 py-4 mb-8">
        <p className="text-[11px] text-zinc-500 uppercase tracking-wide mb-3">How to use</p>
        <pre className="text-[13px] font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap">{`from openai import OpenAI

client = OpenAI(
    base_url="https://api.pinaivu.com/v1",
    api_key="sk-pnv-your-key-here"
)
response = client.chat.completions.create(
    model="qwen-72b",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)`}</pre>
      </div>
      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400 mb-6">{error}</div>}
      {loading ? <p className="text-zinc-600 text-sm">Loading keys...</p> : keys.length === 0 ? <p className="text-zinc-600 text-sm">No keys yet. Create one above.</p> : (
        <div className="overflow-x-auto"><table className="w-full text-sm border-collapse"><thead><tr className="border-b border-surface-2 text-left text-zinc-500 text-[11px] uppercase tracking-wide"><th className="pb-3 pr-6">Key</th><th className="pb-3 pr-6">Name</th><th className="pb-3 pr-6">Created</th><th className="pb-3 pr-6">Last used</th><th className="pb-3" /></tr></thead>
          <tbody>{keys.map((k) => (<tr key={k.id} className="border-b border-surface-2/40 hover:bg-surface-1/50 transition-colors"><td className="py-3 pr-6 font-mono text-indigo-300 text-xs">{k.key_prefix}••••••••</td><td className="py-3 pr-6 text-zinc-300">{k.name ?? <span className="text-zinc-600">—</span>}</td><td className="py-3 pr-6 text-zinc-500">{new Date(k.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td><td className="py-3 pr-6 text-zinc-500">{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : <span className="text-zinc-700">Never</span>}</td><td className="py-3"><RevokeButton keyId={k.id} onRevoked={loadKeys} /></td></tr>))}</tbody></table></div>
      )}
    </div>
  );
}
