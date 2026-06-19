'use client';

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type KeyboardEvent,
} from 'react';
import { ArrowUp, Square } from 'lucide-react';
import clsx from 'clsx';
import { MessageBubble } from './MessageBubble';
import { useStream } from '@/lib/hooks/useStream';
import { getSession, type SessionRecord } from '@/lib/session-store';

interface Props {
  sessionId: string;
}

export function ChatWindow({ sessionId }: Props) {
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [input,   setInput]   = useState('');

  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const reload = useCallback(() => {
    const s = getSession(sessionId);
    setSession(s);
  }, [sessionId]);

  useEffect(() => { reload(); }, [reload]);

  const { streaming, streamingText, error, send, abort } = useStream(
    session ?? { id: sessionId, title: '', createdAt: 0, updatedAt: 0, messages: [] },
    (updated) => setSession(updated),
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages, streamingText]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  async function handleSend() {
    const text = input.trim();
    if (!text || streaming || !session) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await send(text);
    reload();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted text-sm">
        Loading...
      </div>
    );
  }

  const messages = session.messages;
  const isEmpty  = messages.length === 0 && !streaming;

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty && <EmptyState onSuggestion={text => { setInput(text); textareaRef.current?.focus(); }} />}

        <div className="divide-y divide-surface-2/30">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              streaming={streaming && msg.role === 'assistant' && msg === messages[messages.length - 1]}
            />
          ))}
        </div>

        {/* Streaming placeholder */}
        {streaming && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
          <div className="max-w-3xl mx-auto px-4 py-6">
            <div className="flex gap-4">
              <img src="/Pinaivu_logo.jpg" alt="Pinaivu" className="flex-shrink-0 w-8 h-8 rounded-full ring-1 ring-indigo-400/20" />
              <div className="flex-1">
                <div className="text-[13px] font-medium text-zinc-300 mb-2">Pinaivu</div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-accent/60 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-accent/60 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-accent/60 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="max-w-3xl mx-auto px-4 py-2">
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <span>{error}</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 pb-6 pt-2 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="relative rounded-2xl border border-surface-3/60 bg-surface-1
                          focus-within:border-accent/40 focus-within:ring-1 focus-within:ring-accent/10
                          transition-all shadow-lg shadow-black/20">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Pinaivu..."
              disabled={streaming}
              rows={1}
              className={clsx(
                'w-full resize-none bg-transparent px-5 pt-4 pb-14 text-[15px] text-zinc-100',
                'placeholder:text-zinc-500 outline-none max-h-[200px] min-h-[56px]',
                streaming && 'opacity-50 cursor-not-allowed',
              )}
            />

            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              {streaming ? (
                <button
                  onClick={abort}
                  className="p-2 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white transition-colors"
                  title="Stop generating"
                >
                  <Square className="w-4 h-4 fill-current" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className={clsx(
                    'p-2 rounded-xl transition-all',
                    input.trim()
                      ? 'bg-accent hover:bg-accent-hover text-white shadow-md shadow-accent/20'
                      : 'bg-surface-3 text-zinc-600 cursor-not-allowed',
                  )}
                  title="Send (Enter)"
                >
                  <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
                </button>
              )}
            </div>

            <div className="absolute bottom-3 left-4">
              <span className="text-[11px] text-zinc-600">
                Shift+Enter for new line
              </span>
            </div>
          </div>

          <p className="text-[11px] text-zinc-600 text-center mt-2">
            Pinaivu is decentralised AI on Sui. Responses may not always be accurate.
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  const suggestions = [
    { text: 'Explain how Move differs from Solidity', tag: 'Learn' },
    { text: 'Write a Sui Move module for an NFT marketplace', tag: 'Code' },
    { text: 'What are the benefits of decentralised AI inference?', tag: 'Explore' },
    { text: 'Help me understand object-centric design in Sui', tag: 'Sui' },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-6 animate-fade-in">
      <div className="flex flex-col items-center gap-4">
        <img src="/Pinaivu_logo.jpg" alt="Pinaivu" className="w-16 h-16 rounded-2xl ring-1 ring-indigo-400/20" />
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-zinc-100 mb-2">
            How can I help you today?
          </h2>
          <p className="text-zinc-500 text-sm max-w-md">
            Decentralised, private AI inference powered by the Sui network.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-xl">
        {suggestions.map(({ text, tag }) => (
          <button
            key={tag}
            onClick={() => onSuggestion(text)}
            className="group flex flex-col gap-2 rounded-xl border border-surface-3/60
                       bg-surface-1 hover:bg-surface-2 hover:border-accent/30
                       px-4 py-3.5 text-left transition-all"
          >
            <span className="text-[13px] text-zinc-300 group-hover:text-zinc-100 leading-snug">
              {text}
            </span>
            <span className="text-[10px] font-medium text-zinc-600 bg-surface-2 group-hover:bg-surface-3
                             rounded-md px-2 py-0.5 w-fit transition-colors">
              {tag}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
