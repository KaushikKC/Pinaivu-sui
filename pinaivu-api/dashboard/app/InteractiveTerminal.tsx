'use client';

import { useState, useEffect } from 'react';
import { SessionManager } from '~/lib/zklogin/session';

interface Props {
  baseUrl: string;
  defaultModel: string;
}

export function InteractiveTerminal({ baseUrl, defaultModel }: Props) {
  const [apiKey, setApiKey] = useState('sk-pnv-your-key-here');
  const [prompt, setPrompt] = useState('Hello!');
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [latency, setLatency] = useState(0);

  useEffect(() => {
    async function loadKey() {
      const proof = SessionManager.getProof();
      if (!proof) return;
      try {
        const accRes = await fetch('/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: proof.email, wallet_addr: proof.address }),
        });
        if (!accRes.ok) return;
        const acc = await accRes.json();
        const keysRes = await fetch(`/api/keys?account_id=${acc.id}`);
        if (!keysRes.ok) return;
        const keys = await keysRes.json();
        if (keys.length > 0) {
          setApiKey(keys[0].key_prefix + '••••••••');
        }
      } catch {}
    }
    loadKey();
  }, []);

  async function handleRun() {
    setRunning(true);
    setOutput(null);
    setError('');
    const start = Date.now();

    try {
      const res = await fetch('/api/terminal-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model: defaultModel }),
      });
      setLatency(Date.now() - start);

      if (!res.ok) {
        const text = await res.text();
        setError(`Error ${res.status}: ${text.slice(0, 200)}`);
        return;
      }
      const data = await res.json();
      setOutput(data.content ?? JSON.stringify(data, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setRunning(false);
    }
  }

  const gatewayUrl = 'https://api.pinaivu.com';
  const curlCommand = `curl ${gatewayUrl}/v1/chat/completions \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${defaultModel}",
    "messages": [{"role": "user", "content": "${prompt}"}]
  }'`;

  return (
    <div className="bg-[#0c0c0f] border border-surface-2/60 rounded-xl overflow-hidden">
      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-surface-1 border-b border-surface-2/60">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
          <span className="text-[11px] text-zinc-500 ml-2 font-mono">terminal</span>
        </div>
        <button
          onClick={handleRun}
          disabled={running}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25
                     text-emerald-400 text-[11px] font-medium transition-colors disabled:opacity-50"
        >
          {running ? (
            <><span className="w-3 h-3 rounded-full border-2 border-emerald-400/30 border-t-emerald-400 animate-spin" /> Running...</>
          ) : (
            <><svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Run</>
          )}
        </button>
      </div>

      {/* Editable prompt */}
      <div className="px-5 py-3 border-b border-surface-2/30">
        <label className="text-[10px] text-zinc-600 uppercase tracking-wide block mb-1.5">Prompt</label>
        <input
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleRun()}
          className="w-full bg-surface-1/50 border border-surface-3/40 rounded-lg px-3 py-2 text-sm text-emerald-300
                     font-mono outline-none focus:border-accent/40 transition-colors"
          placeholder="Type your prompt..."
        />
      </div>

      {/* Command display */}
      <div className="px-5 py-4 font-mono text-[12px] leading-relaxed overflow-x-auto">
        <p className="text-zinc-600 mb-1"># API request</p>
        <pre className="text-emerald-300/80 whitespace-pre-wrap">{curlCommand}</pre>
      </div>

      {/* Output */}
      {(output || error) && (
        <div className="px-5 py-4 border-t border-surface-2/30">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Response</p>
            {latency > 0 && <span className="text-[10px] text-zinc-600">{(latency / 1000).toFixed(1)}s</span>}
          </div>
          {error ? (
            <pre className="text-red-400 text-[12px] whitespace-pre-wrap">{error}</pre>
          ) : (
            <pre className="text-zinc-300 text-[12px] whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">{output}</pre>
          )}
        </div>
      )}
    </div>
  );
}
