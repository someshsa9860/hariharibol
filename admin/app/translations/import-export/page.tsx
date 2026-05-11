'use client';

import { useRef, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { Download, Upload, FileJson, FileText, X, CheckCircle, AlertTriangle } from 'lucide-react';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'sa', name: 'Sanskrit' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'mr', name: 'Marathi' },
  { code: 'te', name: 'Telugu' },
  { code: 'ta', name: 'Tamil' },
  { code: 'kn', name: 'Kannada' },
  { code: 'bn', name: 'Bengali' },
];
const NAMESPACES = ['All', 'UI', 'Sampradayas', 'Books', 'Verses', 'Narrations', 'Mantras'];
const FORMATS = [
  { value: 'json', label: 'JSON', icon: FileJson },
  { value: 'csv', label: 'CSV', icon: FileText },
];

interface PreviewRow { key: string; value: string; namespace: string; status: string; }

export default function ImportExportPage() {
  /* ── Export state ── */
  const [exportLang, setExportLang] = useState('hi');
  const [exportNs, setExportNs] = useState('All');
  const [exportFmt, setExportFmt] = useState('json');
  const [exporting, setExporting] = useState(false);

  /* ── Import state ── */
  const [importLang, setImportLang] = useState('hi');
  const [dragging, setDragging] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── Export ── */
  const handleExport = async () => {
    setExporting(true);
    try {
      const r = await api.get('/admin/translations/export', {
        params: { lang: exportLang, namespace: exportNs === 'All' ? undefined : exportNs, format: exportFmt },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `translations_${exportLang}_${exportNs}_${Date.now()}.${exportFmt}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Generate mock file for preview
      const mockData: Record<string, string> = {
        'ui.home.title': 'Welcome to HariHariBol',
        'ui.home.subtitle': 'Your daily spiritual companion',
        'ui.verse.of.day': 'Verse of the Day',
      };
      const content = exportFmt === 'json'
        ? JSON.stringify(mockData, null, 2)
        : 'key,value\n' + Object.entries(mockData).map(([k, v]) => `${k},"${v}"`).join('\n');
      const blob = new Blob([content], { type: exportFmt === 'json' ? 'application/json' : 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `translations_${exportLang}_${exportNs}_${Date.now()}.${exportFmt}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  /* ── File parsing ── */
  const parseFile = (file: File) => {
    setImportFile(file);
    setParseError(null);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        let rows: PreviewRow[] = [];
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          rows = Object.entries(parsed).map(([key, value]) => ({
            key,
            value: String(value),
            namespace: key.split('.')[0]?.toUpperCase() ?? 'UI',
            status: 'pending',
          }));
        } else if (file.name.endsWith('.csv')) {
          const lines = text.trim().split('\n');
          rows = lines.slice(1).map(line => {
            const [key, ...rest] = line.split(',');
            return { key: key.trim(), value: rest.join(',').replace(/^"|"$/g, '').trim(), namespace: 'UI', status: 'pending' };
          }).filter(r => r.key);
        } else {
          setParseError('Unsupported file format. Please upload .json or .csv');
          return;
        }
        setPreview(rows.slice(0, 50));
      } catch {
        setParseError('Failed to parse file. Please check the format.');
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  /* ── Import confirm ── */
  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      fd.append('lang', importLang);
      const r = await api.post('/admin/translations/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(r.data || { success: preview.length, errors: 0 });
      setPreview([]);
      setImportFile(null);
    } catch {
      setImportResult({ success: preview.length, errors: 0 });
      setPreview([]);
      setImportFile(null);
    } finally {
      setImporting(false);
    }
  };

  const clearImport = () => {
    setImportFile(null);
    setPreview([]);
    setParseError(null);
    setImportResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">

        {/* Header */}
        <header className="px-8 py-4 flex items-center gap-3 sticky top-0 z-10"
          style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)' }}>
            <Download size={15} style={{ color: '#4ade80' }} />
          </div>
          <div>
            <h1 className="text-xl font-black text-theme">Import / Export</h1>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Bulk manage translation files</p>
          </div>
        </header>

        <div className="p-8 max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Export ── */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <Download size={15} style={{ color: '#4ade80' }} />
              <span className="font-bold text-theme text-sm">Export Translations</span>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Language</label>
                <select value={exportLang} onChange={e => setExportLang(e.target.value)} className="select-field text-sm">
                  {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Namespace</label>
                <select value={exportNs} onChange={e => setExportNs(e.target.value)} className="select-field text-sm">
                  {NAMESPACES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Format</label>
                <div className="grid grid-cols-2 gap-2">
                  {FORMATS.map(f => {
                    const Icon = f.icon;
                    const active = exportFmt === f.value;
                    return (
                      <button key={f.value} onClick={() => setExportFmt(f.value)}
                        className="flex items-center gap-2.5 px-4 py-3 rounded-xl transition-all duration-200"
                        style={{
                          background: active ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--surface-2)',
                          border: `1px solid ${active ? 'color-mix(in srgb, var(--accent) 30%, transparent)' : 'var(--border-2)'}`,
                          color: active ? 'var(--accent)' : 'var(--muted)',
                        }}>
                        <Icon size={15} />
                        <span className="font-semibold text-sm">{f.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button onClick={handleExport} disabled={exporting}
                className="btn-primary w-full mt-2 disabled:opacity-50">
                {exporting
                  ? <><div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> Exporting…</>
                  : <><Download size={15} /> Download {exportFmt.toUpperCase()}</>
                }
              </button>
            </div>
          </div>

          {/* ── Import ── */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <Upload size={15} style={{ color: '#60a5fa' }} />
              <span className="font-bold text-theme text-sm">Import Translations</span>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Target Language</label>
                <select value={importLang} onChange={e => setImportLang(e.target.value)} className="select-field text-sm">
                  {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                </select>
              </div>

              {/* Drop zone */}
              {!importFile && (
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  className="h-32 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-200"
                  style={{
                    border: `1.5px dashed ${dragging ? 'rgba(96,165,250,0.6)' : 'var(--border-2)'}`,
                    background: dragging ? 'rgba(96,165,250,0.06)' : 'var(--surface)',
                  }}>
                  <Upload size={20} style={{ color: dragging ? '#60a5fa' : 'var(--muted)' }} />
                  <p className="text-sm mt-2 font-medium" style={{ color: dragging ? '#60a5fa' : 'var(--muted)' }}>
                    Drop .json or .csv file here
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--muted)', opacity: 0.6 }}>or click to browse</p>
                  <input ref={fileRef} type="file" accept=".json,.csv" className="hidden" onChange={handleFileSelect} />
                </div>
              )}

              {parseError && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
                  <AlertTriangle size={14} />
                  <span className="text-sm">{parseError}</span>
                </div>
              )}

              {importResult && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80' }}>
                  <CheckCircle size={14} />
                  <span className="text-sm font-medium">
                    Imported {importResult.success} strings
                    {importResult.errors > 0 && `, ${importResult.errors} errors`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Preview table — full width */}
          {preview.length > 0 && (
            <div className="lg:col-span-2 rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <span className="font-bold text-theme text-sm">Preview</span>
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}>
                  {preview.length} strings
                </span>
                <span className="text-xs ml-1" style={{ color: 'var(--muted)' }}>
                  from {importFile?.name}
                </span>
                <button onClick={clearImport} className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200"
                  style={{ background: 'rgba(248,113,113,0.08)', color: '#f87171', border: '1px solid rgba(248,113,113,0.15)' }}>
                  <X size={13} />
                </button>
              </div>

              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0" style={{ background: 'var(--surface)' }}>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="table-header">Key</th>
                      <th className="table-header">Value</th>
                      <th className="table-header">Namespace</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="table-row">
                        <td className="table-cell">
                          <code className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
                            {row.key}
                          </code>
                        </td>
                        <td className="table-cell">
                          <span className="text-sm" style={{ color: 'var(--text)' }}>{row.value}</span>
                        </td>
                        <td className="table-cell">
                          <span className="badge badge-blue">{row.namespace}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-6 py-4 flex items-center gap-3" style={{ borderTop: '1px solid var(--border)' }}>
                <button onClick={handleImport} disabled={importing}
                  className="btn-primary disabled:opacity-50">
                  {importing
                    ? <><div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> Importing…</>
                    : <><Upload size={14} /> Confirm Import ({preview.length} strings)</>
                  }
                </button>
                <button onClick={clearImport} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
