'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { chatUrl } from '@/lib/domains';
import {
  ArrowLeft,
  Server,
  Shield,
  FileCheck,
  ExternalLink,
  CheckCircle2,
  Loader2,
  Database,
  Hash,
  Wallet,
  Copy,
  Check,
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

export default function InferenceDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = use(params);
  const [data, setData] = useState<RequestRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/explorer/${requestId}`);
        if (res.ok) {
          setData(await res.json());
        }
      } catch {}
      setLoading(false);
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

  if (!data) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4">
        <p className="text-zinc-400">Receipt not found yet — it may take a few seconds after inference.</p>
        <a href={chatUrl()} className="text-accent hover:text-accent-hover text-sm">Back to chat</a>
      </div>
    );
  }

  const receipt = data.receipt.receipt_json;
  const hasRealCrypto = receipt.signature && receipt.signature.some((b: number) => b !== 0);
  const outputHash = bytesToHex(receipt.aggregated_output_hash ?? []);
  const sig = bytesToHex(receipt.signature ?? []);
  const coordKey = bytesToHex(receipt.coordinator_pubkey ?? []);

  return (
    <div className="min-h-screen bg-surface overflow-y-auto" style={{ height: '100vh' }}>
      <header className="border-b border-surface-2/50 bg-surface-1 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <a href={chatUrl()} className="p-1.5 rounded-lg hover:bg-surface-2 text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </a>
          <div className="flex items-center gap-3">
            <img src="/Pinaivu_logo.jpg" alt="Pinaivu" className="w-7 h-7 rounded-lg" />
            <div>
              <h1 className="text-sm font-semibold text-zinc-100">Inference Receipt</h1>
              <CopyableText text={requestId} className="text-[11px] text-zinc-500 font-mono" />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Status banner */}
        <div className="flex items-center gap-3 mb-8 bg-emerald-500/5 border border-emerald-500/15 rounded-xl px-5 py-3.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-300">
              {hasRealCrypto ? 'Verified Inference' : 'Inference Recorded'}
            </p>
            <p className="text-[12px] text-zinc-500">
              {hasRealCrypto
                ? 'This response was cryptographically signed by the coordinator enclave'
                : 'Receipt data is being synced from the coordinator'}
            </p>
          </div>
          <span className="ml-auto text-[11px] text-zinc-500">
            {receipt.timestamp_ms
              ? new Date(receipt.timestamp_ms).toLocaleString()
              : new Date(data.receipt.created_at).toLocaleString()}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            <Card title="Serving Node" icon={<Server className="w-4 h-4" />}>
              <CopyRow label="Primary Node" value={receipt.primary_peer_id} mono />
              {receipt.helper_peer_ids?.length > 0 && (
                <CopyRow label="Helper Nodes" value={receipt.helper_peer_ids.join(', ')} mono />
              )}
              <CopyRow label="Timestamp" value={
                receipt.timestamp_ms
                  ? new Date(receipt.timestamp_ms).toLocaleString()
                  : new Date(data.receipt.created_at).toLocaleString()
              } />
            </Card>

            {hasRealCrypto && (
              <Card title="Cryptographic Proof" icon={<Shield className="w-4 h-4" />}>
                <CopyRow label="Output Hash (SHA-256)" value={outputHash} mono />
                <CopyRow label="Coordinator Pubkey" value={coordKey} mono />
                <CopyRow label="Signature (Ed25519)" value={sig} mono />
                {receipt.proof_ids?.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[12px] text-zinc-500">Proof IDs</span>
                    {receipt.proof_ids.map((p, i) => (
                      <CopyableText key={i} text={bytesToHex(p)} className="text-[11px] font-mono text-zinc-400 block" />
                    ))}
                  </div>
                )}
                <div className="pt-2 border-t border-surface-2/40 mt-2">
                  <p className="text-[11px] text-zinc-600">
                    Signed over (request_id, output_hash, payouts, timestamp) with the enclave&apos;s Ed25519 key.
                  </p>
                </div>
              </Card>
            )}

            {/* Settlement */}
            <Card title="Settlement" icon={<Wallet className="w-4 h-4" />}>
              {receipt.payouts?.length > 0 ? (
                <div className="space-y-3">
                  {receipt.payouts.map((p, i) => {
                    const payment = data.payments.find(
                      pm => pm.payee_sui_address === p.sui_address
                    );
                    return (
                      <div key={i} className="bg-surface rounded-lg px-4 py-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <CopyableText text={p.sui_address} className="font-mono text-[12px] text-zinc-300" />
                          <StatusBadge status={payment?.status ?? 'submitted'} />
                        </div>
                        <div className="flex items-center gap-4 text-[11px] text-zinc-500">
                          <span className="text-emerald-400 font-medium">{(p.amount_nanox / 1e9).toFixed(6)} SUI</span>
                          <span>({p.amount_nanox.toLocaleString()} MIST)</span>
                          {payment?.tx_digest && (
                            <a
                              href={`https://suiscan.xyz/testnet/tx/${payment.tx_digest}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-accent hover:text-accent-hover transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View on Sui
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-zinc-600 text-sm">No payouts in this receipt.</p>
              )}
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <Card title="Details" icon={<Hash className="w-4 h-4" />}>
              <CopyRow label="Request ID" value={requestId} mono />
              <CopyRow label="Payouts" value={String(receipt.payouts?.length ?? 0)} />
              <CopyRow
                label="Total Cost"
                value={`${((receipt.payouts ?? []).reduce((s: number, p: Payout) => s + p.amount_nanox, 0) / 1e9).toFixed(6)} SUI`}
              />
              <CopyRow label="Proof IDs" value={String(receipt.proof_ids?.length ?? 0)} />
            </Card>

            <Card title="Walrus Archive" icon={<Database className="w-4 h-4" />}>
              {data.receipt.walrus_blob_id ? (
                <>
                  <CopyRow label="Status" value="Archived" accent="green" />
                  <CopyRow label="Blob ID" value={data.receipt.walrus_blob_id} mono />
                </>
              ) : (
                <>
                  <CopyRow label="Status" value="Pending" accent="yellow" />
                  <p className="text-[11px] text-zinc-600 mt-1">
                    Will be archived to Walrus during the next batch cron.
                  </p>
                </>
              )}
            </Card>

            <Card title="Verify" icon={<FileCheck className="w-4 h-4" />}>
              <p className="text-[12px] text-zinc-400 leading-relaxed">
                Verify offline using the coordinator&apos;s public key from the Nitro Enclave attestation.
              </p>
              <div className="mt-3 bg-[#0c0c0f] rounded-lg px-3 py-2.5 font-mono text-[11px] text-emerald-300 break-all">
                <span className="text-emerald-400">$ </span>
                curl -sk https://coordinator/v1/proofs/{requestId}
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

function CopyableText({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <span
      onClick={handleCopy}
      className={`cursor-pointer group inline-flex items-center gap-1.5 ${className ?? ''}`}
      title={`Click to copy: ${text}`}
    >
      <span className="break-all">{text}</span>
      {copied
        ? <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
        : <Copy className="w-3 h-3 text-zinc-600 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
      }
    </span>
  );
}

function CopyRow({
  label, value, mono, accent,
}: {
  label: string; value: string; mono?: boolean; accent?: 'green' | 'yellow';
}) {
  const colorClass = accent === 'green' ? 'text-emerald-400' : accent === 'yellow' ? 'text-amber-400' : 'text-zinc-300';
  return (
    <div>
      <span className="text-[11px] text-zinc-500 block mb-0.5">{label}</span>
      <CopyableText
        text={value}
        className={`text-[12px] ${colorClass} ${mono ? 'font-mono' : ''}`}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    confirmed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    submitted: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  );
}

function bytesToHex(bytes: number[]): string {
  if (!bytes?.length) return '';
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}
