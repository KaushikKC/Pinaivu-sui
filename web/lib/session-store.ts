export type Role = 'user' | 'assistant';

export interface Message {
  id:          string;
  role:        Role;
  content:     string;
  timestamp:   number;
  durationMs?: number;
}

export interface SessionRecord {
  id:        string;
  title:     string;
  createdAt: number;
  updatedAt: number;
  messages:  Message[];
}

const STORAGE_KEY = 'pinaivu:sessions';

function readAll(): SessionRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SessionRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(sessions: SessionRecord[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function listSessions(): SessionRecord[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getSession(id: string): SessionRecord | null {
  return readAll().find(s => s.id === id) ?? null;
}

export function createSession(): SessionRecord {
  const now = Date.now();
  const session: SessionRecord = {
    id:        crypto.randomUUID(),
    title:     'New chat',
    createdAt: now,
    updatedAt: now,
    messages:  [],
  };
  const all = readAll();
  writeAll([session, ...all]);
  return session;
}

export function deleteSession(id: string): void {
  writeAll(readAll().filter(s => s.id !== id));
}

export function appendMessage(
  sessionId: string,
  message:   Omit<Message, 'id' | 'timestamp'>,
): Message {
  const msg: Message = {
    ...message,
    id:        crypto.randomUUID(),
    timestamp: Date.now(),
  };

  const all = readAll();
  const idx = all.findIndex(s => s.id === sessionId);
  if (idx === -1) throw new Error(`session ${sessionId} not found`);

  const session = { ...all[idx] };
  session.messages  = [...session.messages, msg];
  session.updatedAt = Date.now();

  if (session.title === 'New chat' && message.role === 'user') {
    session.title = message.content.slice(0, 60) + (message.content.length > 60 ? '…' : '');
  }

  all[idx] = session;
  writeAll(all);
  return msg;
}

export function updateLastAssistantMessage(
  sessionId: string,
  content:   string,
  extra?:    Partial<Pick<Message, 'durationMs'>>,
): void {
  const all = readAll();
  const idx = all.findIndex(s => s.id === sessionId);
  if (idx === -1) return;

  const msgs = [...all[idx].messages];
  const lastIdx = msgs.length - 1;
  if (lastIdx >= 0 && msgs[lastIdx].role === 'assistant') {
    msgs[lastIdx] = { ...msgs[lastIdx], content, ...extra };
    all[idx] = { ...all[idx], messages: msgs, updatedAt: Date.now() };
    writeAll(all);
  }
}
