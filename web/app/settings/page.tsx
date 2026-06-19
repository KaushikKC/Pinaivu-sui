'use client';

import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { Settings, Trash2, Info } from 'lucide-react';

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
        <h1 className="text-xl font-semibold text-zinc-100 mb-8 flex items-center gap-2.5">
          <Settings className="w-5 h-5 text-accent" />
          Settings
        </h1>

        <div className="space-y-8">
          <AboutSection />
          <DangerZone />
        </div>
      </div>
    </AppShell>
  );
}

function AboutSection() {
  return (
    <section>
      <h2 className="flex items-center gap-2 text-sm font-medium text-zinc-400 mb-3">
        <Info className="w-4 h-4 text-accent" />
        About
      </h2>
      <div className="rounded-xl border border-surface-2/60 bg-surface-1 px-5 py-4 text-sm text-zinc-400 space-y-2">
        <p>
          <strong className="text-zinc-200">Pinaivu</strong> is a decentralised AI inference platform
          built on the Sui blockchain. Your conversations are processed through
          privacy-preserving enclaves.
        </p>
        <p className="text-xs text-zinc-500">
          Version 0.1.0
        </p>
      </div>
    </section>
  );
}

function DangerZone() {
  const [confirmed, setConfirmed] = useState(false);

  function handleClearHistory() {
    if (!confirmed) {
      setConfirmed(true);
      setTimeout(() => setConfirmed(false), 3000);
      return;
    }
    localStorage.removeItem('pinaivu:sessions');
    window.location.href = '/chat';
  }

  return (
    <section>
      <h2 className="flex items-center gap-2 text-sm font-medium text-zinc-400 mb-3">
        <Trash2 className="w-4 h-4 text-red-400" />
        Danger Zone
      </h2>
      <button
        type="button"
        onClick={handleClearHistory}
        className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5
                   hover:bg-red-500/10 px-4 py-3 text-sm text-red-400 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
        {confirmed ? 'Click again to confirm' : 'Clear all chat history'}
      </button>
    </section>
  );
}
