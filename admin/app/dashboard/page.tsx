'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { Users, BookOpen, Zap, AlertCircle } from 'lucide-react';

interface DashboardStats {
  totalUsers: number;
  totalSampradayas: number;
  totalVerses: number;
  bannedUsers: number;
  recentUsers: Array<{
    id: string;
    email: string;
    createdAt: string;
    isBanned: boolean;
  }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/admin/dashboard');
        setStats(response.data.data || response.data);
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 bg-gray-50 min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading...</div>
            </div>
          ) : stats ? (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <StatCard
                  label="Total Users"
                  value={stats.totalUsers}
                  icon={Users}
                  color="bg-blue-500"
                />
                <StatCard
                  label="Traditions"
                  value={stats.totalSampradayas}
                  icon={BookOpen}
                  color="bg-green-500"
                />
                <StatCard
                  label="Verses"
                  value={stats.totalVerses}
                  icon={Zap}
                  color="bg-yellow-500"
                />
                <StatCard
                  label="Banned Users"
                  value={stats.bannedUsers}
                  icon={AlertCircle}
                  color="bg-red-500"
                />
              </div>

              {/* Recent Users */}
              <div className="card">
                <div className="p-6 border-b">
                  <h2 className="text-xl font-bold">Recent Users</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="table-cell text-left font-semibold">Email</th>
                        <th className="table-cell text-left font-semibold">Status</th>
                        <th className="table-cell text-left font-semibold">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentUsers.map((user) => (
                        <tr key={user.id} className="border-t hover:bg-gray-50">
                          <td className="table-cell">{user.email}</td>
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
                            {new Date(user.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="text-red-500">Failed to load dashboard</div>
          )}
        </div>
      </main>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ size: number }>;
  color: string;
}

function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm">{label}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
        </div>
        <div className={`${color} p-3 rounded-lg text-white`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}
