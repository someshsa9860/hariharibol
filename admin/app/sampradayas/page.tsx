'use client';

import { useEffect, useState, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { Plus, Trash2, Edit, Upload } from 'lucide-react';

interface Sampraday {
  id: string;
  slug: string;
  nameKey: string;
  isPublished: boolean;
  followerCount: number;
  displayOrder: number;
}

interface FormData {
  slug: string;
  nameKey: string;
  descriptionKey: string;
  founderKey: string;
  primaryDeityKey: string;
  philosophyKey: string;
  foundingYear: number;
  regionKey: string;
  isPublished: boolean;
  displayOrder: number;
  heroImageFile?: File;
  thumbnailImageFile?: File;
}

export default function SampradayasPage() {
  const [sampradayas, setSampradayas] = useState<Sampraday[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    slug: '',
    nameKey: '',
    descriptionKey: '',
    founderKey: '',
    primaryDeityKey: '',
    philosophyKey: '',
    foundingYear: new Date().getFullYear(),
    regionKey: '',
    isPublished: false,
    displayOrder: 0,
  });
  const [previewUrls, setPreviewUrls] = useState<{ hero?: string; thumbnail?: string }>({});
  const heroInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImages, setUploadingImages] = useState(false);

  useEffect(() => {
    fetchSampradayas();
  }, []);

  const fetchSampradayas = async () => {
    try {
      const response = await api.get('/admin/sampradayas');
      setSampradayas(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch sampradayas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (type: 'hero' | 'thumbnail', file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrls((prev) => ({
        ...prev,
        [type]: reader.result as string,
      }));
    };
    reader.readAsDataURL(file);

    setFormData((prev) => ({
      ...prev,
      [type === 'hero' ? 'heroImageFile' : 'thumbnailImageFile']: file,
    }));
  };

  const uploadImages = async (sampradayId: string) => {
    try {
      setUploadingImages(true);
      if (formData.heroImageFile) {
        const heroFormData = new FormData();
        heroFormData.append('file', formData.heroImageFile);
        await api.post(
          `/admin/sampradayas/${sampradayId}/upload-image`,
          heroFormData,
          { headers: { 'Content-Type': 'multipart/form-data' } },
        );
      }
      if (formData.thumbnailImageFile) {
        const thumbnailFormData = new FormData();
        thumbnailFormData.append('file', formData.thumbnailImageFile);
        await api.post(
          `/admin/sampradayas/${sampradayId}/upload-image`,
          thumbnailFormData,
          { headers: { 'Content-Type': 'multipart/form-data' } },
        );
      }
    } catch (err) {
      console.error('Failed to upload images:', err);
      throw err;
    } finally {
      setUploadingImages(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { heroImageFile, thumbnailImageFile, ...submitData } = formData;

      if (editingId) {
        await api.patch(`/admin/sampradayas/${editingId}`, submitData);
        if (heroImageFile || thumbnailImageFile) {
          await uploadImages(editingId);
        }
      } else {
        const result = await api.post('/admin/sampradayas', submitData);
        if ((heroImageFile || thumbnailImageFile) && result.data.id) {
          await uploadImages(result.data.id);
        }
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({
        slug: '',
        nameKey: '',
        descriptionKey: '',
        founderKey: '',
        primaryDeityKey: '',
        philosophyKey: '',
        foundingYear: new Date().getFullYear(),
        regionKey: '',
        isPublished: false,
        displayOrder: 0,
      });
      setPreviewUrls({});
      fetchSampradayas();
    } catch (err) {
      console.error('Failed to save sampraday:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;

    try {
      await api.delete(`/admin/sampradayas/${id}`);
      fetchSampradayas();
    } catch (err) {
      console.error('Failed to delete sampraday:', err);
    }
  };

  const handleEdit = (sampraday: Sampraday) => {
    setEditingId(sampraday.id);
    setFormData({
      slug: sampraday.slug,
      nameKey: sampraday.nameKey,
      descriptionKey: '',
      founderKey: '',
      primaryDeityKey: '',
      philosophyKey: '',
      foundingYear: new Date().getFullYear(),
      regionKey: '',
      isPublished: sampraday.isPublished,
      displayOrder: sampraday.displayOrder,
    });
    setShowForm(true);
  };

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 bg-gray-50 min-h-screen p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Sampradayas</h1>
            <button
              onClick={() => {
                setShowForm(true);
                setEditingId(null);
                setFormData({ slug: '', nameKey: '', descriptionKey: '', isPublished: false, displayOrder: 0 });
              }}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={20} />
              Add Sampraday
            </button>
          </div>

          {showForm && (
            <div className="card p-6 mb-8">
              <h2 className="text-xl font-bold mb-4">
                {editingId ? 'Edit' : 'Create'} Sampraday
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="input-field"
                    required
                    disabled={!!editingId}
                  />
                  <input
                    type="text"
                    placeholder="Name Key"
                    value={formData.nameKey}
                    onChange={(e) => setFormData({ ...formData, nameKey: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>

                <textarea
                  placeholder="Description Key"
                  value={formData.descriptionKey}
                  onChange={(e) => setFormData({ ...formData, descriptionKey: e.target.value })}
                  className="input-field"
                  rows={3}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Founder Key"
                    value={formData.founderKey}
                    onChange={(e) => setFormData({ ...formData, founderKey: e.target.value })}
                    className="input-field"
                  />
                  <input
                    type="text"
                    placeholder="Primary Deity Key"
                    value={formData.primaryDeityKey}
                    onChange={(e) => setFormData({ ...formData, primaryDeityKey: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Philosophy Key"
                    value={formData.philosophyKey}
                    onChange={(e) => setFormData({ ...formData, philosophyKey: e.target.value })}
                    className="input-field"
                  />
                  <input
                    type="text"
                    placeholder="Region Key"
                    value={formData.regionKey}
                    onChange={(e) => setFormData({ ...formData, regionKey: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="number"
                    placeholder="Founding Year"
                    value={formData.foundingYear}
                    onChange={(e) => setFormData({ ...formData, foundingYear: parseInt(e.target.value) })}
                    className="input-field"
                  />
                  <input
                    type="number"
                    placeholder="Display Order"
                    value={formData.displayOrder}
                    onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) })}
                    className="input-field"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Hero Image</label>
                    <div
                      className="border-2 border-dashed border-gray-300 rounded p-4 text-center cursor-pointer hover:border-blue-400"
                      onClick={() => heroInputRef.current?.click()}
                    >
                      {previewUrls.hero ? (
                        <img
                          src={previewUrls.hero}
                          alt="Hero preview"
                          className="w-full h-32 object-cover rounded"
                        />
                      ) : (
                        <div className="text-gray-500">
                          <Upload size={20} className="mx-auto mb-2" />
                          <p>Click to upload hero image</p>
                        </div>
                      )}
                      <input
                        ref={heroInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          e.target.files && handleImageSelect('hero', e.target.files[0])
                        }
                        className="hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Thumbnail Image</label>
                    <div
                      className="border-2 border-dashed border-gray-300 rounded p-4 text-center cursor-pointer hover:border-blue-400"
                      onClick={() => thumbnailInputRef.current?.click()}
                    >
                      {previewUrls.thumbnail ? (
                        <img
                          src={previewUrls.thumbnail}
                          alt="Thumbnail preview"
                          className="w-full h-32 object-cover rounded"
                        />
                      ) : (
                        <div className="text-gray-500">
                          <Upload size={20} className="mx-auto mb-2" />
                          <p>Click to upload thumbnail</p>
                        </div>
                      )}
                      <input
                        ref={thumbnailInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          e.target.files && handleImageSelect('thumbnail', e.target.files[0])
                        }
                        className="hidden"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isPublished}
                    onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
                    id="published-checkbox"
                  />
                  <label htmlFor="published-checkbox">Published</label>
                </div>

                <div className="flex gap-2">
                  <button type="submit" className="btn-primary" disabled={uploadingImages}>
                    {uploadingImages ? 'Uploading images...' : editingId ? 'Update' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setPreviewUrls({});
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {loading ? (
            <div className="text-center text-gray-500">Loading...</div>
          ) : (
            <div className="card">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="table-cell text-left font-semibold">Name</th>
                      <th className="table-cell text-left font-semibold">Slug</th>
                      <th className="table-cell text-left font-semibold">Followers</th>
                      <th className="table-cell text-left font-semibold">Status</th>
                      <th className="table-cell text-left font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sampradayas.map((s) => (
                      <tr key={s.id} className="border-t hover:bg-gray-50">
                        <td className="table-cell font-medium">{s.nameKey}</td>
                        <td className="table-cell text-gray-600">{s.slug}</td>
                        <td className="table-cell">{s.followerCount}</td>
                        <td className="table-cell">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              s.isPublished
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {s.isPublished ? 'Published' : 'Draft'}
                          </span>
                        </td>
                        <td className="table-cell">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(s)}
                              className="p-2 hover:bg-gray-100 rounded"
                            >
                              <Edit size={18} className="text-blue-500" />
                            </button>
                            <button
                              onClick={() => handleDelete(s.id)}
                              className="p-2 hover:bg-gray-100 rounded"
                            >
                              <Trash2 size={18} className="text-red-500" />
                            </button>
                          </div>
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
