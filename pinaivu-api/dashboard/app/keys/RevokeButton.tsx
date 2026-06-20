'use client';
import { useState } from 'react';

export default function RevokeButton({ keyId, onRevoked }: { keyId: string; onRevoked?: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  async function handleRevoke() { await fetch(`/api/keys/${keyId}`, { method: 'DELETE' }); setDone(true); onRevoked?.(); }

  if (done) return <span className="text-xs text-zinc-600">Revoked</span>;
  if (confirming) return (<span className="flex items-center gap-2 text-xs"><button onClick={handleRevoke} className="text-red-400 hover:text-red-300 transition-colors">Confirm</button><button onClick={() => setConfirming(false)} className="text-zinc-500 hover:text-zinc-300 transition-colors">Cancel</button></span>);
  return <button onClick={() => setConfirming(true)} className="text-xs text-zinc-600 hover:text-red-400 transition-colors">Revoke</button>;
}
