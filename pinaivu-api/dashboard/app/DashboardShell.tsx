'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { SessionManager, type CachedProofData } from '~/lib/zklogin/session';

const PUBLIC_PATHS = ['/login', '/auth/callback'];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [proof, setProof] = useState<CachedProofData | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const p = SessionManager.getProof();
    setProof(p);
    setChecked(true);
    if (!p && !PUBLIC_PATHS.includes(pathname)) router.replace('/login');
  }, [pathname, router]);

  if (!checked) return null;
  if (PUBLIC_PATHS.includes(pathname)) return <>{children}</>;
  if (!proof) return null;

  return (
    <div className="h-full flex">
      <aside className="w-60 shrink-0 bg-surface-1 border-r border-surface-2/50 flex flex-col py-4 px-3">
        <div className="mb-6 px-2 flex items-center gap-2.5">
          <img src="/Pinaivu_logo.jpg" alt="Pinaivu" className="w-7 h-7 rounded-lg" />
          <div><span className="text-sm font-semibold text-zinc-100 tracking-tight">Pinaivu</span><p className="text-[10px] text-zinc-500">Developer Console</p></div>
        </div>
        <nav className="flex flex-col gap-0.5">
          {[['/', 'Overview'], ['/keys', 'API Keys'], ['/usage', 'Usage'], ['/models', 'Models']].map(([href, label]) => (
            <Link key={href} href={href} className={`px-3 py-2.5 rounded-lg text-sm transition-colors ${(href === '/' ? pathname === '/' : pathname.startsWith(href)) ? 'bg-surface-2 text-white' : 'text-zinc-400 hover:text-white hover:bg-surface-2'}`}>{label}</Link>
          ))}
        </nav>
        <div className="mt-auto pt-3 border-t border-surface-2/50 space-y-2">
          <div className="px-3 py-2">
            {proof.email && <p className="text-[11px] text-zinc-400 truncate">{proof.email}</p>}
            <p className="text-[10px] text-zinc-600 font-mono truncate" title={proof.address}>{proof.address.slice(0, 8)}...{proof.address.slice(-6)}</p>
          </div>
          <button onClick={() => { SessionManager.clearAll(); router.replace('/login'); }}
            className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-zinc-500 hover:bg-red-500/10 hover:text-red-400 transition-all">
            <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            <span>Sign out</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8 bg-surface">{children}</main>
    </div>
  );
}
