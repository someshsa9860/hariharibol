'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminStore } from '@/lib/store';
import api from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const setAdmin = useAdminStore((state) => state.setAdmin);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // For demo: authenticate using the backend user endpoints
      // In production, create a dedicated admin auth endpoint
      const response = await api.post('/auth/login', {
        email,
        password,
      });

      if (response.data.accessToken) {
        localStorage.setItem('admin_token', response.data.accessToken);
        setAdmin({
          id: response.data.user.id,
          email: response.data.user.email,
        });
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-light flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <div className="text-center mb-8">
            <div className="text-4xl mb-4">🙏</div>
            <h1 className="text-3xl font-bold text-dark">HariHariBol</h1>
            <p className="text-gray-600 mt-2">Admin Panel</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="admin@example.com"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-gray-600 text-sm mt-6">
            Demo: Use your HariHariBol account
          </p>
        </div>
      </div>
    </div>
  );
}
