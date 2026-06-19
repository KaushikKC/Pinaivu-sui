'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { listSessions, createSession } from '@/lib/session-store';
export default function ChatIndexPage() {
  const router = useRouter();

  useEffect(() => {
    const sessions = listSessions();
    if (sessions.length > 0) {
      router.replace(`/chat/${sessions[0].id}`);
      return;
    }
    const s = createSession();
    router.replace(`/chat/${s.id}`);
  }, [router]);

  return (
    <AppShell>
      <div className="flex-1 flex items-center justify-center text-muted gap-3">
        <img src="/Pinaivu_logo.jpg" alt="Pinaivu" className="w-6 h-6 rounded-lg animate-pulse" />
        <span className="text-sm text-zinc-500">Loading...</span>
      </div>
    </AppShell>
  );
}
