'use client';
import { useState } from 'react';

export default function CreateKeyForm({ accountId, onCreated }: { accountId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [result, setResult] = useState<{ key: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    if (!name.trim()) { setError('Give your key a name first.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/keys', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ account_id: accountId, name: name.trim(), rpm_limit: 60, daily_limit: 10000 }) });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error'); } finally { setLoading(false); }
  }

  if (result) return (
    <div className="bg-surface-1 border border-emerald-500/20 rounded-xl px-5 py-4 max-w-md">
      <p className="text-sm font-medium text-emerald-400 mb-3">Key created — copy it now, it won&apos;t be shown again.</p>
      <div className="flex items-center gap-2 mb-3"><code className="flex-1 bg-[#0c0c0f] rounded-lg px-3 py-2 text-xs font-mono text-emerald-300 break-all">{result.key}</code>
        <button onClick={() => { navigator.clipboard.writeText(result.key); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="shrink-0 px-3 py-2 bg-surface-2 hover:bg-surface-3 text-xs text-zinc-300 rounded-lg transition-colors">{copied ? 'Copied!' : 'Copy'}</button></div>
      <button onClick={() => { setResult(null); setOpen(false); setName(''); onCreated(); }} className="text-xs text-zinc-500 hover:text-zinc-300">Done</button>
    </div>
  );

  if (!open) return <button onClick={() => setOpen(true)} className="px-4 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm rounded-xl transition-colors">+ Create key</button>;

  return (
    <div className="flex items-center gap-3">
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} placeholder="Key name  e.g. production, test" className="w-56 bg-surface-1 border border-surface-3/60 focus:border-accent/40 rounded-xl px-3 py-2.5 text-sm text-white outline-none transition-colors" />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button onClick={handleCreate} disabled={loading} className="px-4 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm rounded-xl transition-colors">{loading ? 'Creating…' : 'Create'}</button>
      <button onClick={() => setOpen(false)} className="text-sm text-zinc-500 hover:text-zinc-300">Cancel</button>
    </div>
  );
}
