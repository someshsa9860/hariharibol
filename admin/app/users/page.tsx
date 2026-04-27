'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { Ban, CheckCircle } from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string | null;
  isBanned: boolean;
  bannedReason: string | null;
  createdAt: string;
  lastActiveAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [banningId, setBanningId] = useState<string | null>(null);
  const [banReason, setBanReason] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/admin/users');
      setUsers(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBan = async (userId: string) => {
    if (!banReason.trim()) {
      alert('Please enter a reason');
      return;
    }

    try {
      await api.post(`/admin/users/${userId}/ban`, { reason: banReason });
      setBanningId(null);
      setBanReason('');
      fetchUsers();
    } catch (err) {
      console.error('Failed to ban user:', err);
    }
  };

  const handleUnban = async (userId: string) => {
    try {
      await api.post(`/admin/users/${userId}/unban`);
      fetchUsers();
    } catch (err) {
      console.error('Failed to unban user:', err);
    }
  };

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 bg-gray-50 min-h-screen p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">User Management</h1>

          {loading ? (
            <div className="text-center text-gray-500">Loading...</div>
          ) : (
            <div className="card">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="table-cell text-left font-semibold">Email</th>
                      <th className="table-cell text-left font-semibold">Name</th>
                      <th className="table-cell text-left font-semibold">Joined</th>
                      <th className="table-cell text-left font-semibold">Status</th>
                      <th className="table-cell text-left font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-t hover:bg-gray-50">
                        <td className="table-cell font-medium">{user.email}</td>
                        <td className="table-cell">{user.name || '-'}</td>
                        <td className="table-cell">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="table-cell">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              user.isBanned
                                ? 'bg-red-100 text-red-700'
                                : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {user.isBanned ? 'Banned' : 'Active'}
                          </span>
                        </td>
                        <td className="table-cell">
                          {user.isBanned ? (
                            <div>
                              <p className="text-xs text-gray-600 mb-2">
                                Reason: {user.bannedReason}
                              </p>
                              <button
                                onClick={() => handleUnban(user.id)}
                                className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
                              >
                                <CheckCircle size={16} />
                                Unban
                              </button>
                            </div>
                          ) : (
                            <div>
                              {banningId === user.id ? (
                                <div className="flex gap-2 items-end">
                                  <input
                                    type="text"
                                    placeholder="Reason"
                                    value={banReason}
                                    onChange={(e) => setBanReason(e.target.value)}
                                    className="input-field text-sm px-2 py-1"
                                  />
                                  <button
                                    onClick={() => handleBan(user.id)}
                                    className="btn-primary text-sm px-3 py-1"
                                  >
                                    Confirm
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setBanningId(user.id)}
                                  className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
                                >
                                  <Ban size={16} />
                                  Ban
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
