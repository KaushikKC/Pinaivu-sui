'use client';

import { useState } from 'react';
import { SessionSidebar } from './SessionSidebar';

interface Props {
  children: React.ReactNode;
}

export function AppShell({ children }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-full">
      <SessionSidebar collapsed={collapsed} onCollapse={setCollapsed} />
      <main className="flex-1 flex flex-col min-w-0 bg-surface">
        {children}
      </main>
    </div>
  );
}
