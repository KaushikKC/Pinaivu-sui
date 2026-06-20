'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Plus,
  MessageSquare,
  Trash2,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Search,
  LogOut,
} from 'lucide-react';
import { SessionManager as ZkSession } from '@/lib/zklogin/session';
import clsx from 'clsx';
import {
  listSessions,
  createSession,
  deleteSession,
  type SessionRecord,
} from '@/lib/session-store';

interface Props {
  collapsed:  boolean;
  onCollapse: (v: boolean) => void;
}

export function SessionSidebar({ collapsed, onCollapse }: Props) {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [zkAddress, setZkAddress] = useState<string | null>(null);
  const [zkEmail, setZkEmail] = useState<string | null>(null);
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const proof = ZkSession.getProof();
    if (proof) {
      setZkAddress(proof.address);
      setZkEmail(proof.email ?? null);
    }
  }, []);

  function handleLogout() {
    ZkSession.clearAll();
    router.replace('/login');
  }

  const refresh = useCallback(() => setSessions(listSessions()), []);

  useEffect(() => {
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'pinaivu:sessions') refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refresh]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        handleNew();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  function handleNew() {
    const session = createSession();
    refresh();
    router.push(`/chat/${session.id}`);
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    deleteSession(id);
    refresh();
    if (pathname === `/chat/${id}`) router.push('/chat');
  }

  function formatDate(ts: number) {
    const d = new Date(ts);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
    if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7)  return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  return (
    <aside
      className={clsx(
        'flex flex-col h-full bg-surface-1 border-r border-surface-2/50 transition-all duration-200',
        collapsed ? 'w-[52px]' : 'w-64',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <img src="/Pinaivu_logo.jpg" alt="Pinaivu" className="w-6 h-6 rounded-lg" />
            <span className="text-sm font-semibold text-zinc-100 tracking-tight">Pinaivu</span>
          </div>
        )}
        <button
          onClick={() => onCollapse(!collapsed)}
          className={clsx(
            'p-1.5 rounded-lg hover:bg-surface-2 text-muted hover:text-white transition-colors',
            collapsed && 'mx-auto',
          )}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* New Chat */}
      <div className="px-2 pb-1">
        <button
          onClick={handleNew}
          className={clsx(
            'w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm',
            'border border-surface-3/60 hover:border-accent/40 hover:bg-surface-2',
            'text-zinc-300 hover:text-white transition-all',
            collapsed ? 'justify-center' : '',
          )}
          title="New chat (⌘K)"
        >
          <Plus className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>New chat</span>}
        </button>
      </div>

      {/* Session list */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {sessions.length === 0 && !collapsed && (
          <p className="text-xs text-muted px-3 py-6 text-center leading-relaxed">
            No conversations yet
          </p>
        )}

        {sessions.map(session => {
          const isActive = pathname === `/chat/${session.id}`;
          return (
            <Link
              key={session.id}
              href={`/chat/${session.id}`}
              className={clsx(
                'group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-all',
                isActive
                  ? 'bg-surface-2 text-white'
                  : 'text-zinc-400 hover:bg-surface-2/60 hover:text-zinc-200',
                collapsed ? 'justify-center' : '',
              )}
              title={collapsed ? session.title : undefined}
            >
              <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />

              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-[13px] leading-snug">{session.title}</div>
                    <div className="text-[10px] text-muted mt-0.5">
                      {formatDate(session.updatedAt)}
                    </div>
                  </div>

                  <button
                    onClick={e => handleDelete(e, session.id)}
                    className={clsx(
                      'flex-shrink-0 p-1 rounded-md opacity-0 group-hover:opacity-100',
                      'hover:bg-surface-3 hover:text-red-400 text-muted transition-all',
                    )}
                    title="Delete chat"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="border-t border-surface-2/50 px-2 py-2 space-y-0.5">
          <Link
            href="/explorer"
            className={clsx(
              'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-zinc-400',
              'hover:bg-surface-2/60 hover:text-zinc-200 transition-all',
              pathname === '/explorer' && 'bg-surface-2 text-white',
            )}
          >
            <Search className="w-3.5 h-3.5 opacity-60" />
            <span>Explorer</span>
          </Link>
          <Link
            href="/settings"
            className={clsx(
              'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-zinc-400',
              'hover:bg-surface-2/60 hover:text-zinc-200 transition-all',
              pathname === '/settings' && 'bg-surface-2 text-white',
            )}
          >
            <Settings className="w-3.5 h-3.5 opacity-60" />
            <span>Settings</span>
          </Link>
          {zkAddress && (
            <div className="pt-2 mt-1 border-t border-surface-2/50">
              <div className="px-3 py-2">
                {zkEmail && (
                  <p className="text-[11px] text-zinc-400 truncate">{zkEmail}</p>
                )}
                <p className="text-[10px] text-zinc-600 font-mono truncate" title={zkAddress}>
                  {zkAddress.slice(0, 8)}...{zkAddress.slice(-6)}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-zinc-500
                           hover:bg-red-500/10 hover:text-red-400 transition-all"
              >
                <LogOut className="w-3.5 h-3.5 opacity-60" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
