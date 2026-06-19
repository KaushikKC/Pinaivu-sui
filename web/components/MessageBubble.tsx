'use client';

import { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { User, Sparkles, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import clsx from 'clsx';
import type { Message } from '@/lib/session-store';

interface Props {
  message:    Message;
  streaming?: boolean;
}

function parseContent(raw: string): { thinking: string; answer: string; inThink: boolean } {
  if (!raw.startsWith('<think>')) return { thinking: '', answer: raw, inThink: false };

  const closeIdx = raw.indexOf('</think>');
  if (closeIdx === -1) {
    return { thinking: raw.slice(7), answer: '', inThink: true };
  }

  return {
    thinking: raw.slice(7, closeIdx).trim(),
    answer:   raw.slice(closeIdx + 8).trim(),
    inThink:  false,
  };
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded-md hover:bg-surface-3 text-muted hover:text-zinc-300 transition-all"
      title="Copy message"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export const MessageBubble = memo(function MessageBubble({ message, streaming }: Props) {
  const isUser = message.role === 'user';
  const [thinkOpen, setThinkOpen] = useState(false);

  const { thinking, answer, inThink } = isUser
    ? { thinking: '', answer: message.content, inThink: false }
    : parseContent(message.content);

  return (
    <div className="animate-fade-in">
      <div
        className={clsx(
          'group max-w-3xl mx-auto px-4 py-6',
          !isUser && 'relative',
        )}
      >
        <div className="flex gap-4">
          {/* Avatar */}
          <div
            className={clsx(
              'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
              isUser
                ? 'bg-accent/15 ring-1 ring-accent/20'
                : 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20 ring-1 ring-indigo-400/20',
            )}
          >
            {isUser
              ? <User className="w-4 h-4 text-accent" />
              : <Sparkles className="w-4 h-4 text-indigo-400" />
            }
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Label row */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[13px] font-medium text-zinc-300">
                {isUser ? 'You' : 'Pinaivu'}
              </span>
            </div>

            {/* Thinking block */}
            {!isUser && (thinking || inThink) && (
              <div className="mb-3">
                <button
                  onClick={() => setThinkOpen(v => !v)}
                  className="flex items-center gap-1.5 text-[12px] text-muted hover:text-zinc-300 transition-colors"
                >
                  {thinkOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  <span className="italic">
                    {inThink && streaming ? 'Thinking...' : 'Thought process'}
                  </span>
                  {inThink && streaming && (
                    <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse-slow ml-0.5" />
                  )}
                </button>

                {thinkOpen && (
                  <div className="mt-2 pl-4 border-l-2 border-surface-3 text-[13px] text-zinc-500
                                  leading-relaxed whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
                    {thinking}
                  </div>
                )}
              </div>
            )}

            {/* Main answer */}
            {isUser ? (
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words text-zinc-200">
                {answer}
              </p>
            ) : (
              <div className={clsx('prose-chat text-zinc-200', streaming && !inThink && 'cursor-blink')}>
                {answer ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
                ) : inThink ? null : streaming ? (
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="w-1.5 h-1.5 bg-accent/60 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-accent/60 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-accent/60 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                ) : (
                  <span className="text-muted text-sm">...</span>
                )}
              </div>
            )}

            {/* Footer actions */}
            {!isUser && !streaming && answer && (
              <div className="mt-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <CopyButton text={answer} />
                {message.durationMs !== undefined && (
                  <span className="text-[11px] text-muted">
                    {formatDuration(message.durationMs)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
