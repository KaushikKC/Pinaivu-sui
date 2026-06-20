'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ZkLoginService, type DecodedJWT } from '~/lib/zklogin/zklogin';
import { SessionManager } from '~/lib/zklogin/session';
import { jwtDecode } from 'jwt-decode';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'processing'|'success'|'error'>('processing');
  const [statusText, setStatusText] = useState('Generating zero-knowledge proof...');
  const [errorMsg, setErrorMsg] = useState('');
  const processingRef = useRef(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || processingRef.current) return;
    processingRef.current = true;
    const urlParams = new URLSearchParams(hash.substring(1));
    const jwtToken = urlParams.get('id_token');
    if (!jwtToken) { setStatus('error'); setErrorMsg('No token found.'); return; }

    (async () => {
      try {
        const session = SessionManager.getSession();
        if (!session) throw new Error('No active session.');
        const decodedJWT = jwtDecode<DecodedJWT>(jwtToken);
        const encoder = new TextEncoder();
        const encoded = encoder.encode(decodedJWT.sub);
        const hashVal = Array.from(encoded).reduce((acc, val) => (acc << 5) - acc + val, 0);
        const salt = Math.abs(hashVal).toString();
        setStatusText('Verifying with Enoki...');
        const ephemeralKeyPair = ZkLoginService.recreateKeyPair(session.ephemeralPrivateKey);
        const zkProof = await ZkLoginService.fetchZkProof({ jwtToken, ephemeralKeyPair, randomness: session.randomness, maxEpoch: parseInt(session.maxEpoch), userSalt: salt });
        const address = ZkLoginService.getZkLoginAddress(jwtToken, salt, zkProof.addressSeed);
        SessionManager.saveProof({ zkProof, jwtToken, address, userSalt: salt, maxEpoch: parseInt(session.maxEpoch), randomness: session.randomness, ephemeralPrivateKey: session.ephemeralPrivateKey, email: decodedJWT.email });
        setStatusText('Setting up your account...');
        try { await fetch('/api/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: decodedJWT.email, wallet_addr: address }) }); } catch {}
        SessionManager.clearSession();
        window.history.replaceState(null, '', window.location.pathname);
        setStatus('success');
        setTimeout(() => router.replace('/'), 1200);
      } catch (err: unknown) { setStatus('error'); setErrorMsg(err instanceof Error ? err.message : 'Failed.'); }
    })();
  }, [router]);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="bg-surface-1 rounded-2xl border border-surface-2/60 p-10 max-w-md w-full text-center space-y-6">
        {status === 'processing' && <><div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-accent/10 mx-auto"><span className="w-10 h-10 rounded-full border-4 border-surface-3 border-t-accent animate-spin block"/></div><div><h2 className="text-xl font-semibold text-zinc-100">Setting up your account</h2><p className="text-sm text-zinc-500">{statusText}</p></div></>}
        {status === 'success' && <><div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-emerald-500/10 mx-auto"><svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg></div><div><h2 className="text-xl font-semibold text-zinc-100">You&apos;re in!</h2><p className="text-sm text-zinc-500">Taking you to your dashboard...</p></div></>}
        {status === 'error' && <><div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-red-500/10 mx-auto"><svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div><div><h2 className="text-xl font-semibold text-zinc-100">Login Failed</h2><p className="text-sm text-red-400">{errorMsg}</p></div><button onClick={() => router.replace('/login')} className="w-full h-12 bg-accent hover:bg-accent-hover text-white rounded-xl font-medium text-sm transition-all">Try Again</button></>}
      </div>
    </div>
  );
}
