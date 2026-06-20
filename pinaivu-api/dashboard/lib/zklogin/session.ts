export interface ZkLoginSessionData {
  ephemeralPrivateKey: string;
  randomness: string;
  maxEpoch: string;
  nonce: string;
}

export interface CachedProofData {
  zkProof: any;
  jwtToken: string;
  address: string;
  userSalt: string;
  maxEpoch: number;
  randomness: string;
  ephemeralPrivateKey: string;
  email?: string;
  createdAt?: number;
  expiresAt?: number;
}

const SESSION_KEY = 'pinaivu-zklogin-session';
const PROOF_KEY = 'pinaivu-zklogin-proof';
const CACHE_TTL = 24 * 60 * 60 * 1000;

export class SessionManager {
  static saveSession(session: ZkLoginSessionData) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
  }

  static getSession(): ZkLoginSessionData | null {
    if (typeof window === 'undefined') return null;
    const data = localStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : null;
  }

  static clearSession() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_KEY);
    }
  }

  static saveProof(proofData: Omit<CachedProofData, 'createdAt' | 'expiresAt'>) {
    if (typeof window !== 'undefined') {
      const now = Date.now();
      const data: CachedProofData = {
        ...proofData,
        createdAt: now,
        expiresAt: now + CACHE_TTL,
      };
      localStorage.setItem(PROOF_KEY, JSON.stringify(data));
    }
  }

  static getProof(): CachedProofData | null {
    if (typeof window === 'undefined') return null;
    const data = localStorage.getItem(PROOF_KEY);
    if (!data) return null;

    try {
      const parsed: CachedProofData = JSON.parse(data);
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        this.clearProof();
        return null;
      }
      return parsed;
    } catch {
      this.clearProof();
      return null;
    }
  }

  static clearProof() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(PROOF_KEY);
    }
  }

  static clearAll() {
    this.clearSession();
    this.clearProof();
  }
}
