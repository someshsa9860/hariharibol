import { create } from 'zustand';
import axios from 'axios';

interface Admin {
  id: string;
  email: string;
}

interface AdminStore {
  admin: Admin | null;
  isLoading: boolean;
  error: string | null;
  setAdmin: (admin: Admin) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => Promise<void>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3015/api/v1';

export const useAdminStore = create<AdminStore>((set) => ({
  admin: null,
  isLoading: false,
  error: null,
  setAdmin: (admin) => set({ admin, error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  logout: async () => {
    try {
      await axios.post(`${API_BASE}/auth/admin/logout`, {}, { withCredentials: true });
    } catch {}
    set({ admin: null });
  },
}));
