'use client';

import { useState, useEffect, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { chatUrl } from '@/lib/domains';
import {
  Search,
  ArrowRight,
  Clock,
  Server,
  Wallet,
  Shield,
  ExternalLink,
  Loader2,
} from 'lucide-react';

interface RecentReceipt {
  request_id: string;
  receipt_json: {
    primary_peer_id?: string;
    payouts?: { sui_address: string; amount_nanox: number }[];
    timestamp_ms?: number;
    aggregated_output_hash?: number[];
  };
  created_at: string;
  walrus_blob_id: string | null;
}

export default function ExplorerPage() {
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<RecentReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    async function loadRecent() {
      try {
        const res = await fetch('/api/explorer/recent?limit=20');
        if (res.ok) setRecent(await res.json());
      } catch {}
      setLoading(false);
    }
    loadRecent();
  }, []);

  async function handleSearch() {
    const id = query.trim();
    if (!id) return;
    setError('');
    setSearching(true);

    try {
      const res = await fetch(`/api/explorer/${id}`);
      if (res.ok) {
        router.push(`/r/${id}`);
        return;
      }
    } catch {}

    setError('Receipt not found. Check the ID and try again.');
    setSearching(false);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleSearch();
  }

  return (
    <div className="min-h-screen bg-surface overflow-y-auto" style={{ height: '100vh' }}>
      {/* Header */}
      <header className="border-b border-surface-2/50 bg-surface-1 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/Pinaivu_logo.jpg" alt="Pinaivu" className="w-7 h-7 rounded-lg" />
            <div>
              <h1 className="text-sm font-semibold text-zinc-100">Pinaivu Explorer</h1>
              <p className="text-[10px] text-zinc-500">Inference receipts & on-chain settlements</p>
            </div>
          </div>
          <a href={chatUrl()} className="text-[12px] text-accent hover:text-accent-hover transition-colors">
            Back to Chat
          </a>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Hero search */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img src="/Pinaivu_logo.jpg" alt="" className="w-12 h-12 rounded-2xl ring-1 ring-indigo-400/20" />
          </div>
          <h2 className="text-3xl font-semibold text-zinc-100 mb-2">Pinaivu Explorer</h2>
          <p className="text-zinc-500 text-sm mb-8">
            Search inference receipts by request ID. Verify cryptographic proofs and on-chain settlements.
          </p>

          {/* Search bar */}
          <div className="max-w-2xl mx-auto">
            <div className="relative flex items-center">
              <Search className="absolute left-4 w-5 h-5 text-zinc-500" />
              <input
                value={query}
                onChange={e => { setQuery(e.target.value); setError(''); }}
                onKeyDown={handleKeyDown}
                placeholder="Search by Request ID (e.g. 6756e5b0-f8ea-4493-9671-f7ec061f9e6e)"
                className="w-full pl-12 pr-28 py-4 rounded-2xl border border-surface-3/60 bg-surface-1
                           text-zinc-100 placeholder:text-zinc-600 outline-none
                           focus:border-accent/40 focus:ring-1 focus:ring-accent/10
                           text-[15px] font-mono transition-all"
              />
              <button
                onClick={handleSearch}
                disabled={!query.trim() || searching}
                className="absolute right-2 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover
                           disabled:bg-surface-3 disabled:text-zinc-600
                           text-white text-sm font-medium transition-colors"
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
              </button>
            </div>
            {error && (
              <p className="text-red-400 text-sm mt-3">{error}</p>
            )}
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <StatCard icon={<Shield className="w-4 h-4" />} label="Verified Receipts" value={String(recent.length)} />
          <StatCard icon={<Server className="w-4 h-4" />} label="Active Nodes" value={recent.length > 0 ? String(new Set(recent.map(r => r.receipt_json.primary_peer_id)).size) : '0'} />
          <StatCard icon={<Wallet className="w-4 h-4" />} label="Total Settled" value={formatSui(recent.reduce((s, r) => s + (r.receipt_json.payouts ?? []).reduce((a, p) => a + p.amount_nanox, 0), 0))} />
          <StatCard icon={<Clock className="w-4 h-4" />} label="Latest" value={recent[0] ? timeAgo(recent[0].created_at) : '—'} />
        </div>

        {/* Recent receipts */}
        <div>
          <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wide mb-4">
            Recent Inference Receipts
          </h3>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-accent animate-spin" />
            </div>
          ) : recent.length === 0 ? (
            <div className="bg-surface-1 border border-surface-2/60 rounded-xl px-6 py-10 text-center">
              <p className="text-zinc-500 text-sm">No receipts yet. Send a message in chat to create one.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map((r) => (
                <ReceiptRow key={r.request_id} receipt={r} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReceiptRow({ receipt }: { receipt: RecentReceipt }) {
  const rj = receipt.receipt_json;
  const totalPayout = (rj.payouts ?? []).reduce((s, p) => s + p.amount_nanox, 0);
  const hasProof = rj.aggregated_output_hash?.some(b => b !== 0);

  return (
    <Link
      href={`/r/${receipt.request_id}`}
      className="group flex items-center gap-4 bg-surface-1 border border-surface-2/60 rounded-xl px-5 py-4
                 hover:border-accent/30 hover:bg-surface-2/30 transition-all"
    >
      {/* Icon */}
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
        {hasProof
          ? <Shield className="w-5 h-5 text-accent" />
          : <Clock className="w-5 h-5 text-zinc-500" />
        }
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-[13px] text-zinc-200 truncate">
            {receipt.request_id}
          </span>
          {hasProof && (
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              verified
            </span>
          )}
          {receipt.walrus_blob_id && (
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              archived
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1">
            <Server className="w-3 h-3" />
            {rj.primary_peer_id ? rj.primary_peer_id.slice(0, 20) + '…' : 'unknown'}
          </span>
          <span>{timeAgo(receipt.created_at)}</span>
        </div>
      </div>

      {/* Payout */}
      <div className="flex-shrink-0 text-right">
        {totalPayout > 0 ? (
          <div>
            <span className="text-sm font-medium text-emerald-400">{formatSui(totalPayout)}</span>
            <span className="text-[10px] text-zinc-500 block">SUI</span>
          </div>
        ) : (
          <span className="text-[11px] text-zinc-600">free</span>
        )}
      </div>

      {/* Arrow */}
      <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-accent flex-shrink-0 transition-colors" />
    </Link>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-surface-1 border border-surface-2/60 rounded-xl px-4 py-3.5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-accent">{icon}</span>
        <span className="text-[11px] text-zinc-500">{label}</span>
      </div>
      <span className="text-lg font-semibold text-zinc-100">{value}</span>
    </div>
  );
}

function formatSui(nanox: number): string {
  if (nanox === 0) return '0';
  return (nanox / 1e9).toFixed(6);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
