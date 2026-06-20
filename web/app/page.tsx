'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SessionManager } from '@/lib/zklogin/session';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const proof = SessionManager.getProof();
    router.replace(proof ? '/chat' : '/login');
  }, [router]);

  return null;
}
