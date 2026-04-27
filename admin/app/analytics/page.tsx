'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { TrendingUp, Users, Heart, Share2 } from 'lucide-react';

interface AnalyticsMetrics {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  totalVerses: number;
  totalSampradayas: number;
  totalFollows: number;
  totalFavorites: number;
  averageSessionDuration: number;
}

interface EngagementData {
  totalSessions: number;
  totalFavorites: number;
  totalFollows: number;
  averageFavoritesPerUser: number;
  averageFollowsPerUser: number;
}

interface GrowthDataPoint {
  date: string;
  users: number;
}

export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [growthData, setGrowthData] = useState<GrowthDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('month');

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const [metricsRes, engagementRes, growthRes] = await Promise.all([
        api.get(`/admin/analytics/metrics?period=${period}`),
        api.get('/admin/analytics/engagement'),
        api.get(`/admin/analytics/user-growth?days=${period === 'day' ? 1 : period === 'week' ? 7 : 30}`),
      ]);

      setMetrics(metricsRes.data);
      setEngagement(engagementRes.data);
      setGrowthData(growthRes.data.data || []);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, label, value, subtext }: any) => (
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{label}</p>
          <h3 className="text-3xl font-bold mt-2">{value.toLocaleString()}</h3>
          {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
        </div>
        <div className="bg-blue-100 p-3 rounded-lg">
          <Icon size={24} className="text-blue-600" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 bg-gray-50 min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Analytics</h1>
            <div className="flex gap-2">
              {(['day', 'week', 'month'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    period === p
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading analytics...</div>
            </div>
          ) : (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                  icon={Users}
                  label="Total Users"
                  value={metrics?.totalUsers || 0}
                  subtext={`${metrics?.newUsersToday || 0} new today`}
                />
                <StatCard
                  icon={TrendingUp}
                  label="Active Users"
                  value={metrics?.activeUsers || 0}
                  subtext={`Last ${period}`}
                />
                <StatCard
                  icon={Heart}
                  label="Total Favorites"
                  value={metrics?.totalFavorites || 0}
                  subtext={`${engagement?.averageFavoritesPerUser || 0} per user avg`}
                />
                <StatCard
                  icon={Share2}
                  label="Total Follows"
                  value={metrics?.totalFollows || 0}
                  subtext={`${engagement?.averageFollowsPerUser || 0} per user avg`}
                />
              </div>

              {/* Content Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="card p-6">
                  <h3 className="font-semibold mb-2">Total Verses</h3>
                  <p className="text-3xl font-bold text-orange-600">
                    {metrics?.totalVerses?.toLocaleString()}
                  </p>
                </div>
                <div className="card p-6">
                  <h3 className="font-semibold mb-2">Total Sampradayas</h3>
                  <p className="text-3xl font-bold text-blue-600">
                    {metrics?.totalSampradayas?.toLocaleString()}
                  </p>
                </div>
                <div className="card p-6">
                  <h3 className="font-semibold mb-2">Engagement Rate</h3>
                  <p className="text-3xl font-bold text-green-600">
                    {metrics?.totalFavorites && metrics?.totalUsers
                      ? ((metrics.totalFavorites / metrics.totalUsers) * 100).toFixed(1)
                      : 0}
                    %
                  </p>
                </div>
              </div>

              {/* User Growth Chart */}
              {growthData.length > 0 && (
                <div className="card p-6 mb-8">
                  <h3 className="text-xl font-bold mb-4">User Growth</h3>
                  <div className="space-y-2">
                    {growthData.slice(-7).map((point) => (
                      <div key={point.date} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">{point.date}</span>
                        <div className="flex-1 mx-4 bg-gray-200 rounded h-2">
                          <div
                            className="bg-blue-600 h-2 rounded"
                            style={{
                              width: `${
                                (point.users /
                                  Math.max(
                                    ...growthData.map((d) => d.users),
                                    1,
                                  )) *
                                100
                              }%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium">{point.users}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Engagement Breakdown */}
              <div className="card p-6">
                <h3 className="text-xl font-bold mb-4">Engagement Breakdown</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                  <div>
                    <p className="text-gray-600 text-sm">Total Sessions</p>
                    <p className="text-2xl font-bold mt-2">
                      {engagement?.totalSessions?.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Total Favorites</p>
                    <p className="text-2xl font-bold mt-2">
                      {engagement?.totalFavorites?.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Total Follows</p>
                    <p className="text-2xl font-bold mt-2">
                      {engagement?.totalFollows?.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Avg Favorites/User</p>
                    <p className="text-2xl font-bold mt-2">
                      {engagement?.averageFavoritesPerUser}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Avg Follows/User</p>
                    <p className="text-2xl font-bold mt-2">
                      {engagement?.averageFollowsPerUser}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
