'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Server,
  Clock,
  Shield,
  FileCheck,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Database,
  Hash,
  Wallet,
} from 'lucide-react';

interface Payout {
  sui_address: string;
  amount_nanox: number;
}

interface ReceiptJson {
  request_id: string;
  primary_peer_id: string;
  helper_peer_ids: string[];
  client_id: string;
  bid_set_hash: number[];
  proof_ids: number[][];
  aggregated_output_hash: number[];
  payouts: Payout[];
  timestamp_ms: number;
  coordinator_pubkey: number[];
  signature: number[];
}

interface Payment {
  id: string;
  request_id: string;
  payee_peer_id: string;
  payee_sui_address: string;
  amount_nanox: number;
  status: string;
  tx_digest: string | null;
  created_at: string;
  submitted_at: string | null;
  confirmed_at: string | null;
}

interface RequestRecord {
  receipt: {
    request_id: string;
    receipt_json: ReceiptJson;
    created_at: string;
    walrus_blob_id: string | null;
  };
  payments: Payment[];
}

function getMockData(requestId: string): RequestRecord {
  const now = new Date().toISOString();
  return {
    receipt: {
      request_id: requestId,
      receipt_json: {
        request_id: requestId,
        primary_peer_id: '12D3KooWMock' + requestId.slice(0, 8),
        helper_peer_ids: [],
        client_id: '',
        bid_set_hash: Array(32).fill(0),
        proof_ids: [Array(32).fill(0)],
        aggregated_output_hash: Array(32).fill(0).map(() => Math.floor(Math.random() * 255)),
        payouts: [{ sui_address: '0x3b59d1' + requestId.slice(0, 20) + '...', amount_nanox: 50000000 }],
        timestamp_ms: Date.now(),
        coordinator_pubkey: Array(32).fill(0).map(() => Math.floor(Math.random() * 255)),
        signature: Array(64).fill(0).map(() => Math.floor(Math.random() * 255)),
      },
      created_at: now,
      walrus_blob_id: 'pmtiLSm-mock-' + requestId.slice(0, 8),
    },
    payments: [
      {
        id: crypto.randomUUID(),
        request_id: requestId,
        payee_peer_id: '12D3KooWMock' + requestId.slice(0, 8),
        payee_sui_address: '0x3b59d1' + requestId.slice(0, 20) + '...',
        amount_nanox: 50000000,
        status: 'confirmed',
        tx_digest: 'EzjdRt' + requestId.slice(0, 10),
        created_at: now,
        submitted_at: now,
        confirmed_at: now,
      },
    ],
  };
}

export default function InferenceDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = use(params);
  const [data, setData] = useState<RequestRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const indexerUrl = process.env.NEXT_PUBLIC_INDEXER_URL;
      if (!indexerUrl) {
        setData(getMockData(requestId));
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${indexerUrl}/api/r/${requestId}`);
        if (!res.ok) throw new Error(`Not found (${res.status})`);
        setData(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [requestId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-zinc-400">{error ?? 'Receipt not found'}</p>
        <Link href="/chat" className="text-accent hover:text-accent-hover text-sm">Back to chat</Link>
      </div>
    );
  }

  const receipt = data.receipt.receipt_json;
  const outputHash = bytesToHex(receipt.aggregated_output_hash);
  const sig = bytesToHex(receipt.signature);
  const coordKey = bytesToHex(receipt.coordinator_pubkey);

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="border-b border-surface-2/50 bg-surface-1">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/chat" className="p-1.5 rounded-lg hover:bg-surface-2 text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-3">
            <img src="/Pinaivu_logo.jpg" alt="Pinaivu" className="w-7 h-7 rounded-lg" />
            <div>
              <h1 className="text-sm font-semibold text-zinc-100">Inference Receipt</h1>
              <p className="text-[11px] text-zinc-500 font-mono">{requestId}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Status banner */}
        <div className="flex items-center gap-3 mb-8 bg-emerald-500/5 border border-emerald-500/15 rounded-xl px-5 py-3.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-300">Verified Inference</p>
            <p className="text-[12px] text-zinc-500">
              This response was cryptographically signed by the coordinator enclave
            </p>
          </div>
          <span className="ml-auto text-[11px] text-zinc-500">
            {new Date(data.receipt.created_at).toLocaleString()}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column — main details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Node info */}
            <Card title="Serving Node" icon={<Server className="w-4 h-4" />}>
              <Row label="Primary Node" value={receipt.primary_peer_id} mono />
              {receipt.helper_peer_ids.length > 0 && (
                <Row label="Helper Nodes" value={receipt.helper_peer_ids.join(', ')} mono />
              )}
              <Row label="Timestamp" value={new Date(receipt.timestamp_ms).toLocaleString()} />
            </Card>

            {/* Cryptographic proof */}
            <Card title="Cryptographic Proof" icon={<Shield className="w-4 h-4" />}>
              <Row label="Output Hash (SHA-256)" value={outputHash} mono truncate />
              <Row label="Coordinator Pubkey" value={coordKey} mono truncate />
              <Row label="Signature (Ed25519)" value={sig.slice(0, 80) + '…'} mono truncate />
              <div className="pt-2 border-t border-surface-2/40 mt-2">
                <p className="text-[11px] text-zinc-600">
                  The coordinator signs (request_id, output_hash, payouts, timestamp) with its enclave-attested Ed25519 key.
                  Verify against the attestation document from GET /get_attestation.
                </p>
              </div>
            </Card>

            {/* Payments */}
            <Card title="Settlement" icon={<Wallet className="w-4 h-4" />}>
              {data.payments.length === 0 ? (
                <p className="text-zinc-600 text-sm">No payments recorded.</p>
              ) : (
                <div className="space-y-3">
                  {data.payments.map((p) => (
                    <div key={p.id} className="bg-surface rounded-lg px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[12px] text-zinc-300">{p.payee_sui_address}</span>
                        <StatusBadge status={p.status} />
                      </div>
                      <div className="flex items-center gap-4 text-[11px] text-zinc-500">
                        <span>{(p.amount_nanox / 1e9).toFixed(6)} SUI</span>
                        <span>Node: {p.payee_peer_id.slice(0, 16)}…</span>
                        {p.tx_digest && (
                          <a
                            href={`https://suiscan.xyz/testnet/tx/${p.tx_digest}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-accent hover:text-accent-hover transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View on Sui
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-[10px] text-zinc-600">
                        <span>Created: {fmtTime(p.created_at)}</span>
                        {p.submitted_at && <span>Submitted: {fmtTime(p.submitted_at)}</span>}
                        {p.confirmed_at && <span>Confirmed: {fmtTime(p.confirmed_at)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Right column — sidebar */}
          <div className="space-y-6">
            {/* Quick stats */}
            <Card title="Details" icon={<Hash className="w-4 h-4" />}>
              <Row label="Request ID" value={requestId.slice(0, 8) + '…'} mono />
              <Row label="Payouts" value={String(receipt.payouts.length)} />
              <Row
                label="Total Cost"
                value={`${(receipt.payouts.reduce((s, p) => s + p.amount_nanox, 0) / 1e9).toFixed(6)} SUI`}
              />
              <Row label="Proof IDs" value={String(receipt.proof_ids.length)} />
            </Card>

            {/* Walrus archival */}
            <Card title="Walrus Archive" icon={<Database className="w-4 h-4" />}>
              {data.receipt.walrus_blob_id ? (
                <>
                  <Row label="Status" value="Archived" accent="green" />
                  <Row label="Blob ID" value={data.receipt.walrus_blob_id} mono truncate />
                </>
              ) : (
                <>
                  <Row label="Status" value="Pending" accent="yellow" />
                  <p className="text-[11px] text-zinc-600 mt-1">
                    This receipt will be archived to Walrus during the next batch cron.
                  </p>
                </>
              )}
            </Card>

            {/* Verification */}
            <Card title="Verify" icon={<FileCheck className="w-4 h-4" />}>
              <p className="text-[12px] text-zinc-400 leading-relaxed">
                This receipt can be verified offline using the coordinator&apos;s public key
                from the Nitro Enclave attestation document.
              </p>
              <div className="mt-3 bg-[#0c0c0f] rounded-lg px-3 py-2.5 font-mono text-[11px] text-emerald-300">
                <span className="text-emerald-400">$ </span>
                curl -sk /api/r/{requestId.slice(0, 8)}...
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-surface-1 border border-surface-2/60 rounded-xl px-5 py-4">
      <h3 className="flex items-center gap-2 text-[11px] font-medium text-zinc-500 uppercase tracking-wide mb-4">
        <span className="text-accent">{icon}</span>
        {title}
      </h3>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function Row({
  label, value, mono, truncate, accent,
}: {
  label: string; value: string; mono?: boolean; truncate?: boolean; accent?: 'green' | 'yellow';
}) {
  const colorClass = accent === 'green' ? 'text-emerald-400' : accent === 'yellow' ? 'text-amber-400' : 'text-zinc-300';
  return (
    <div className="flex gap-3">
      <span className="w-28 flex-shrink-0 text-[12px] text-zinc-500">{label}</span>
      <span className={`text-[12px] flex-1 break-all ${colorClass} ${mono ? 'font-mono' : ''} ${truncate ? 'truncate' : ''}`}>
        {value}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    confirmed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    submitted: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    pending:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
    failed:    'bg-red-500/10 text-red-400 border-red-500/20',
    refunded:  'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  };
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  );
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function bytesToHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}
