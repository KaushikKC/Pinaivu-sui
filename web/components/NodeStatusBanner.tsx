'use client';

import { useState } from 'react';
import { AlertTriangle, RefreshCw, ServerOff } from 'lucide-react';
import clsx from 'clsx';
import { useNodeStatus } from '@/lib/hooks/useNodeStatus';

/**
 * Slim warning bar shown at the top of the chat when inference can't be served:
 * either no GPU node is connected, or the backend is unreachable. Stays visible
 * while the condition holds and re-checks automatically; the Retry button forces
 * an immediate recheck (e.g. right after the operator starts a node).
 */
export function NodeStatusBanner() {
  const { status, refresh } = useNodeStatus();
  const [retrying, setRetrying] = useState(false);

  // Nothing to warn about when serving, in demo mode, or still loading.
  if (status === 'online' || status === 'demo' || status === 'loading') return null;

  const offline = status === 'offline';

  async function handleRetry() {
    setRetrying(true);
    await refresh();
    setTimeout(() => setRetrying(false), 600);
  }

  return (
    <div
      role="alert"
      className={clsx(
        'flex-shrink-0 border-b px-4 py-2.5',
        offline
          ? 'bg-red-500/10 border-red-500/20'
          : 'bg-amber-500/10 border-amber-500/20',
      )}
    >
      <div className="max-w-3xl mx-auto flex items-start gap-3">
        {offline ? (
          <ServerOff className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
        ) : (
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-400" />
        )}

        <div className="flex-1 min-w-0">
          {offline ? (
            <p className={clsx('text-[13px] leading-snug', 'text-red-300')}>
              <span className="font-medium">Can&apos;t reach the Pinaivu backend.</span>{' '}
              The coordinator or gateway isn&apos;t responding — check that it&apos;s
              running and that <code className="text-red-200/90 bg-red-500/10 rounded px-1 py-0.5 text-[11px]">PINAIVU_API_URL</code> is correct.
            </p>
          ) : (
            <p className="text-[13px] leading-snug text-amber-200">
              <span className="font-medium">No GPU node is connected.</span>{' '}
              There&apos;s no node serving inference right now, so messages can&apos;t
              be answered. Start a Pinaivu node and connect it to the coordinator:
            </p>
          )}

          {!offline && (
            <code className="mt-1.5 block text-[11px] font-mono text-amber-100/90 bg-amber-500/10 rounded-md px-2.5 py-1.5 overflow-x-auto whitespace-pre">
              cargo run -- --coordinator-http $PINAIVU_API_URL --model &lt;model&gt; --payout-address &lt;sui-address&gt;
            </code>
          )}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {!offline && (
            <a
              href="https://docs.pinaivu.com/quickstart"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-medium text-amber-300 hover:text-amber-200 underline underline-offset-2 whitespace-nowrap"
            >
              Setup guide
            </a>
          )}
          <button
            onClick={handleRetry}
            disabled={retrying}
            className={clsx(
              'flex items-center gap-1.5 text-[12px] font-medium whitespace-nowrap transition-colors disabled:opacity-50',
              offline ? 'text-red-300 hover:text-red-200' : 'text-amber-300 hover:text-amber-200',
            )}
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', retrying && 'animate-spin')} />
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}
