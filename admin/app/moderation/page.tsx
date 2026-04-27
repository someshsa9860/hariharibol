'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { CheckCircle, XCircle } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  user: { email: string; name: string };
  group: { id: string; name: string };
  createdAt: string;
  isModerated: boolean;
  isFlagged: boolean;
}

export default function ModerationPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    fetchMessages();
  }, [filter]);

  const fetchMessages = async () => {
    try {
      const response = await api.get(`/admin/moderation/queue?status=${filter}`);
      setMessages(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch moderation queue:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (messageId: string) => {
    try {
      await api.post(`/admin/moderation/messages/${messageId}/approve`);
      fetchMessages();
    } catch (err) {
      console.error('Failed to approve message:', err);
    }
  };

  const handleReject = async (messageId: string) => {
    if (!rejectReason.trim()) {
      alert('Please enter a reason');
      return;
    }

    try {
      await api.post(`/admin/moderation/messages/${messageId}/reject`, {
        reason: rejectReason,
      });
      setRejectingId(null);
      setRejectReason('');
      fetchMessages();
    } catch (err) {
      console.error('Failed to reject message:', err);
    }
  };

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 bg-gray-50 min-h-screen p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Moderation Queue</h1>

          <div className="flex gap-4 mb-8">
            {['pending', 'approved', 'rejected'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  filter === f
                    ? 'bg-primary text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center text-gray-500">Loading...</div>
          ) : messages.length === 0 ? (
            <div className="card p-8 text-center text-gray-500">
              No messages to review
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className="card p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="font-semibold">{msg.user.email}</p>
                      <p className="text-sm text-gray-600">{msg.group.name}</p>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(msg.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-gray-800 mb-4">{msg.content}</p>

                  {filter === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(msg.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200"
                      >
                        <CheckCircle size={18} />
                        Approve
                      </button>
                      {rejectingId === msg.id ? (
                        <div className="flex gap-2 flex-1">
                          <input
                            type="text"
                            placeholder="Reason"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="input-field text-sm"
                          />
                          <button
                            onClick={() => handleReject(msg.id)}
                            className="btn-primary text-sm"
                          >
                            Confirm
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setRejectingId(msg.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          <XCircle size={18} />
                          Reject
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
