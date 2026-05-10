'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAdminStore } from '@/lib/store';

export default function Home() {
  const router = useRouter();
  const admin = useAdminStore((s) => s.admin);

  useEffect(() => {
    // If we have admin in state, go to dashboard, else try dashboard (cookie will auth or 401 redirects to login)
    router.push(admin ? '/dashboard' : '/login');
  }, [router, admin]);

  return null;
}
