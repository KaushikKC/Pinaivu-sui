'use client';

import { useState, useRef, useCallback } from 'react';
import {
  appendMessage,
  updateLastAssistantMessage,
  updateSessionCoordinator,
  getSession,
  type SessionRecord,
  type InferenceMetadata,
} from '../session-store';

export interface StreamState {
  streaming:     boolean;
  streamingText: string;
  error:         string | null;
}

export function useStream(
  session:  SessionRecord,
  onUpdate: (session: SessionRecord) => void,
) {
  const [state, setState] = useState<StreamState>({
    streaming:     false,
    streamingText: '',
    error:         null,
  });

  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (userText: string) => {
      if (state.streaming) return;

      appendMessage(session.id, { role: 'user', content: userText });
      appendMessage(session.id, { role: 'assistant', content: '' });

      const afterAppend = getSession(session.id);
      if (afterAppend) onUpdate(afterAppend);

      const controller = new AbortController();
      abortRef.current = controller;

      setState({ streaming: true, streamingText: '', error: null });

      let accumulated = '';
      let inferenceData: InferenceMetadata | undefined;
      const startMs = Date.now();

      try {
        const currentSession = getSession(session.id);
        const messages = (currentSession?.messages ?? [])
          .filter(m => m.content.trim())
          .slice(0, -1)
          .map(m => ({ role: m.role, content: m.content }));
        messages.push({ role: 'user', content: userText });

        const currentSessionData = getSession(session.id);
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages,
            session_id: currentSessionData?.coordinatorSessionId,
            session_key: currentSessionData?.sessionKey,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) throw new Error('No response stream');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

          for (const line of lines) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);

              if (parsed.meta) {
                inferenceData = {
                  requestId:     parsed.meta.request_id,
                  nodePeerId:    parsed.meta.node_peer_id ?? parsed.meta.primary_peer_id,
                  latencyMs:     parsed.meta.latency_ms,
                  recalledFacts: parsed.meta.recalled_facts,
                };
                if (parsed.meta.session_id && parsed.meta.session_key) {
                  updateSessionCoordinator(session.id, parsed.meta.session_id, parsed.meta.session_key);
                }
                continue;
              }

              const token = parsed.choices?.[0]?.delta?.content ?? '';
              if (token) {
                accumulated += token;
                setState(prev => ({ ...prev, streamingText: accumulated }));
                updateLastAssistantMessage(session.id, accumulated);
              }
            } catch {
              // non-JSON line, skip
            }
          }
        }

        updateLastAssistantMessage(session.id, accumulated, {
          durationMs: Date.now() - startMs,
          inference: inferenceData,
        });
        setState({ streaming: false, streamingText: '', error: null });
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          updateLastAssistantMessage(session.id, accumulated || '[Stopped]');
          setState({ streaming: false, streamingText: '', error: null });
          return;
        }
        const msg = err instanceof Error ? err.message : String(err);
        updateLastAssistantMessage(session.id, accumulated || `[Error: ${msg}]`);
        setState({ streaming: false, streamingText: '', error: msg });
      } finally {
        const updated = getSession(session.id);
        if (updated) onUpdate(updated);
      }
    },
    [session, state.streaming, onUpdate],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { ...state, send, abort };
}
