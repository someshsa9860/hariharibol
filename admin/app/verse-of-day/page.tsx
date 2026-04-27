'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { RefreshCw, Wand2, Search, Copy } from 'lucide-react';

interface VerseOfDay {
  id: string;
  date: string;
  verse: {
    id: string;
    sanskrit: string;
    transliteration: string;
    meaning: string;
  };
  imageUrl?: string;
  explanation?: string;
  aiGenerated: boolean;
}

interface Config {
  aiProvider: 'gemini' | 'openai' | 'none';
  apiKey?: string;
  autoGenerate: boolean;
  generateImage: boolean;
}

interface Verse {
  id: string;
  transliteration: string;
  sanskrit: string;
}

export default function VerseOfDayPage() {
  const [todayVerse, setTodayVerse] = useState<VerseOfDay | null>(null);
  const [history, setHistory] = useState<VerseOfDay[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showSelectModal, setShowSelectModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [todayRes, historyRes, configRes, versesRes] = await Promise.all([
        api.get('/verses/of-day'),
        api.get('/verses/of-day/history'),
        api.get('/verses/of-day/admin/config'),
        api.get('/verses'),
      ]);

      setTodayVerse(todayRes.data);
      setHistory(historyRes.data?.data || []);
      setConfig(configRes.data);
      setVerses(versesRes.data?.data || []);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateConfig = async (updates: Partial<Config>) => {
    try {
      const updated = { ...config, ...updates };
      const response = await api.patch('/verses/of-day/admin/config', updates);
      setConfig(response.data);
      setShowConfigModal(false);
    } catch (err) {
      console.error('Failed to update config:', err);
    }
  };

  const handleGenerateVerse = async () => {
    try {
      setGenerating(true);
      const response = await api.post('/verses/of-day/admin/generate');
      setTodayVerse(response.data);
      await fetchData();
    } catch (err) {
      console.error('Failed to generate verse:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectVerse = async (verseId: string) => {
    try {
      const response = await api.post(`/verses/of-day/admin/select/${verseId}`);
      setTodayVerse(response.data);
      setShowSelectModal(false);
      await fetchData();
    } catch (err) {
      console.error('Failed to select verse:', err);
    }
  };

  const handleGenerateImage = async (verseId: string) => {
    try {
      setGenerating(true);
      const response = await api.post(`/verses/of-day/admin/generate-image/${verseId}`);
      setTodayVerse(response.data);
      await fetchData();
    } catch (err) {
      console.error('Failed to generate image:', err);
    } finally {
      setGenerating(false);
    }
  };

  const filteredVerses = verses.filter(
    (v) =>
      v.transliteration.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.sanskrit.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 bg-gray-50 min-h-screen p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Verse of Day Management</h1>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfigModal(true)}
                className="btn-secondary flex items-center gap-2"
              >
                Settings
              </button>
              <button
                onClick={handleGenerateVerse}
                disabled={generating || config?.aiProvider === 'none'}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                <Wand2 size={20} />
                {config?.aiProvider === 'none' ? 'Configure AI' : 'AI Generate'}
              </button>
              <button
                onClick={() => setShowSelectModal(true)}
                className="btn-primary flex items-center gap-2"
              >
                Select Verse
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center text-gray-500">Loading...</div>
          ) : (
            <>
              {/* Today's Verse */}
              {todayVerse && (
                <div className="card p-8 mb-8 bg-gradient-to-br from-orange-50 to-amber-50">
                  <div className="flex gap-8">
                    <div className="flex-1">
                      <h2 className="text-sm text-gray-600 uppercase tracking-wide mb-2">
                        Verse of Today
                      </h2>
                      <p className="text-2xl font-bold text-gray-900 mb-4">
                        {todayVerse.verse.transliteration}
                      </p>
                      <p className="text-lg text-gray-700 italic mb-4">
                        {todayVerse.verse.sanskrit}
                      </p>
                      <p className="text-gray-600 mb-4">{todayVerse.verse.meaning}</p>
                      {todayVerse.explanation && (
                        <div className="bg-white bg-opacity-50 p-4 rounded mb-4">
                          <p className="text-sm text-gray-600">
                            <strong>AI Explanation:</strong> {todayVerse.explanation}
                          </p>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            todayVerse.aiGenerated
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {todayVerse.aiGenerated ? 'AI Generated' : 'Manually Selected'}
                        </span>
                        {todayVerse.imageUrl && (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                            Image Generated
                          </span>
                        )}
                      </div>
                    </div>

                    {todayVerse.imageUrl && (
                      <div className="w-48 h-48 flex-shrink-0">
                        <img
                          src={todayVerse.imageUrl}
                          alt="Verse"
                          className="w-full h-full object-cover rounded-lg"
                        />
                      </div>
                    )}
                  </div>

                  {!todayVerse.imageUrl && config?.generateImage && (
                    <button
                      onClick={() => handleGenerateImage(todayVerse.verse.id)}
                      disabled={generating}
                      className="mt-4 btn-secondary flex items-center gap-2 disabled:opacity-50"
                    >
                      <Wand2 size={16} />
                      Generate Image
                    </button>
                  )}
                </div>
              )}

              {/* Configuration Modal */}
              {showConfigModal && config && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg max-w-md w-full p-6">
                    <h2 className="text-2xl font-bold mb-6">Configuration</h2>

                    <div className="space-y-4 mb-6">
                      <div>
                        <label className="block text-sm font-medium mb-2">AI Provider</label>
                        <select
                          value={config.aiProvider}
                          onChange={(e) =>
                            handleUpdateConfig({
                              aiProvider: e.target.value as 'gemini' | 'openai' | 'none',
                            })
                          }
                          className="input-field w-full"
                        >
                          <option value="none">None (Manual Only)</option>
                          <option value="gemini">Google Gemini</option>
                          <option value="openai">OpenAI</option>
                        </select>
                      </div>

                      {config.aiProvider !== 'none' && (
                        <div>
                          <label className="block text-sm font-medium mb-2">API Key</label>
                          <input
                            type="password"
                            placeholder="Enter API key"
                            className="input-field w-full"
                            onBlur={(e) => {
                              if (e.target.value) {
                                handleUpdateConfig({ apiKey: e.target.value });
                              }
                            }}
                          />
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={config.autoGenerate}
                          onChange={(e) =>
                            handleUpdateConfig({ autoGenerate: e.target.checked })
                          }
                          id="auto-generate"
                        />
                        <label htmlFor="auto-generate" className="text-sm">
                          Auto-generate Verse of Day daily
                        </label>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={config.generateImage}
                          onChange={(e) =>
                            handleUpdateConfig({ generateImage: e.target.checked })
                          }
                          id="generate-image"
                        />
                        <label htmlFor="generate-image" className="text-sm">
                          Generate image for verse
                        </label>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowConfigModal(false)}
                        className="flex-1 btn-secondary"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Select Verse Modal */}
              {showSelectModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-96 overflow-y-auto">
                    <h2 className="text-2xl font-bold mb-4 sticky top-0 bg-white pb-4">
                      Select Verse of Day
                    </h2>

                    <div className="mb-4 sticky top-12 bg-white">
                      <input
                        type="text"
                        placeholder="Search verses..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input-field w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      {filteredVerses.slice(0, 20).map((verse) => (
                        <button
                          key={verse.id}
                          onClick={() => handleSelectVerse(verse.id)}
                          className="w-full text-left p-4 border rounded-lg hover:bg-blue-50 transition"
                        >
                          <p className="font-medium text-gray-900">{verse.transliteration}</p>
                          <p className="text-sm text-gray-600 italic">{verse.sanskrit}</p>
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => setShowSelectModal(false)}
                      className="mt-4 w-full btn-secondary"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              {/* History */}
              <div className="card">
                <h3 className="text-xl font-bold p-6 border-b">Recent Verses</h3>
                <div className="divide-y">
                  {history.slice(0, 10).map((item) => (
                    <div key={item.id} className="p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {new Date(item.date).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {item.verse.transliteration}
                          </p>
                        </div>
                        {item.imageUrl && (
                          <img
                            src={item.imageUrl}
                            alt="Verse"
                            className="w-12 h-12 object-cover rounded ml-4"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
