import { create } from 'zustand';

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
  logout: () => void;
}

export const useAdminStore = create<AdminStore>((set) => ({
  admin: null,
  isLoading: false,
  error: null,
  setAdmin: (admin) => set({ admin, error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin_token');
    }
    set({ admin: null });
  },
}));
