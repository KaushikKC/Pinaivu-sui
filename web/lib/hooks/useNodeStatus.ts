'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type NodeStatus = 'loading' | 'online' | 'no-nodes' | 'offline' | 'demo';

/**
 * Polls /api/status so the UI knows whether a GPU node is connected.
 * Returns the current status plus a `refresh` for a manual recheck.
 */
export function useNodeStatus(pollMs = 20000) {
  const [status, setStatus] = useState<NodeStatus>('loading');
  const [nodes, setNodes] = useState(0);
  const activeRef = useRef(true);

  const check = useCallback(async () => {
    try {
      const res = await fetch('/api/status', { cache: 'no-store' });
      const data = await res.json();
      if (!activeRef.current) return;
      setStatus((data.status as NodeStatus) ?? 'offline');
      setNodes(typeof data.nodes === 'number' ? data.nodes : 0);
    } catch {
      if (activeRef.current) setStatus('offline');
    }
  }, []);

  useEffect(() => {
    activeRef.current = true;
    check();
    const id = setInterval(check, pollMs);
    return () => {
      activeRef.current = false;
      clearInterval(id);
    };
  }, [check, pollMs]);

  return { status, nodes, refresh: check };
}
