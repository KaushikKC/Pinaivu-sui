'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ZkLoginService } from '~/lib/zklogin/zklogin';
import { SessionManager } from '~/lib/zklogin/session';
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const REDIRECT_URI = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '';

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (SessionManager.getProof()) router.replace('/'); }, [router]);
  const handleZkLogin = async () => {
    if (!GOOGLE_CLIENT_ID) { setError('Google Client ID not configured.'); return; }
    setIsLoading(true); setError('');
    try { const { nonce } = await ZkLoginService.initializeSession(); window.location.href = ZkLoginService.getOAuthUrl(nonce, GOOGLE_CLIENT_ID, REDIRECT_URI); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); setIsLoading(false); }
  };
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6"><div className="w-full max-w-md space-y-8">
      <div className="text-center space-y-4"><div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mx-auto overflow-hidden ring-1 ring-indigo-400/20"><img src="/Pinaivu_logo.jpg" alt="Pinaivu" className="w-full h-full object-cover" /></div>
        <div><h1 className="text-3xl font-bold tracking-tight text-zinc-100">Pinaivu API</h1><p className="text-sm text-zinc-500 mt-1">Developer Console</p></div></div>
      <div className="bg-surface-1 rounded-2xl border border-surface-2/60 p-8 space-y-6">
        <div><h2 className="text-xl font-semibold text-zinc-100">Sign in</h2><p className="text-sm text-zinc-500 mt-1">Sign in with Google to manage your API keys.</p></div>
        <button onClick={handleZkLogin} disabled={isLoading || !GOOGLE_CLIENT_ID} className="w-full flex items-center justify-center gap-3 h-14 px-6 bg-surface-2 border border-surface-3/60 hover:border-accent/40 hover:bg-surface-3 text-zinc-100 rounded-xl font-medium text-sm transition-all disabled:opacity-50">
          {isLoading ? <><span className="w-5 h-5 rounded-full border-2 border-zinc-600 border-t-accent animate-spin" /><span>Connecting...</span></> : <><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>Continue with Google</>}
        </button>
        {error && <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}
      </div>
      <p className="text-center text-[11px] text-zinc-600">Powered by <span className="font-medium text-zinc-400">Sui Network</span> · zkLogin</p>
    </div></div>
  );
}
