import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { deleteFromCloudinary } from '../../../lib/cloudinary';
import { CloudinaryUpload } from '../../../components/ece/CloudinaryUpload';
import { extractYouTubeId } from '../../../components/ece/YouTubePlayer';
import { BookOpen, Plus, Trash2, Loader2, X, Check, GripVertical, Pencil } from 'lucide-react';

const TYPES = ['pdf', 'video', 'career', 'image'];
const EMPTY_FORM = { topic_id: '', type: 'pdf', title: '', description: '', url: '', public_id: '', youtube_id: '', order_num: 0 };

export function AdminEceResources() {
  const [topics, setTopics] = useState([]);
  const [resources, setResources] = useState([]);
  const [filterTopic, setFilterTopic] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [youtubeInput, setYoutubeInput] = useState('');

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editYoutubeInput, setEditYoutubeInput] = useState('');

  const loadData = async () => {
    const [topicsRes, resRes] = await Promise.all([
      supabase.from('ece_topics').select('id, name').order('order_num'),
      supabase.from('ece_resources').select('*, ece_topics(name)').order('order_num'),
    ]);
    setTopics(topicsRes.data || []);
    setResources(resRes.data || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      topic_id: form.topic_id || null,
      type: form.type,
      title: form.title.trim(),
      description: form.description.trim() || null,
      url: form.url || null,
      public_id: form.public_id || null,
      youtube_id: form.youtube_id || null,
      order_num: Number(form.order_num) || 0,
    };
    await supabase.from('ece_resources').insert(payload);
    setSaving(false);
    setForm(EMPTY_FORM);
    setYoutubeInput('');
    setShowForm(false);
    loadData();
  };

  const handleDelete = async (res) => {
    if (!window.confirm(`Delete "${res.title}"?`)) return;
    setDeletingId(res.id);
    // Sync delete from Cloudinary if file
    if (res.public_id && (res.type === 'pdf' || res.type === 'image')) {
      await deleteFromCloudinary(res.public_id, res.type === 'pdf' ? 'raw' : 'image');
    }
    await supabase.from('ece_resources').delete().eq('id', res.id);
    setDeletingId(null);
    loadData();
  };

  const handleFileUpload = (url, public_id) => {
    setForm((f) => ({ ...f, url, public_id }));
  };

  const handleFileDelete = async (public_id) => {
    await deleteFromCloudinary(public_id, form.type === 'pdf' ? 'raw' : 'image');
    setForm((f) => ({ ...f, url: '', public_id: '' }));
  };

  const handleYoutubeChange = (val) => {
    setYoutubeInput(val);
    const id = extractYouTubeId(val);
    setForm((f) => ({ ...f, youtube_id: id || '' }));
  };

  // ── Edit handlers ──────────────────────────────────────────────
  const handleEditStart = (res) => {
    setEditingId(res.id);
    setEditForm({
      topic_id: res.topic_id || '',
      type: res.type,
      title: res.title,
      description: res.description || '',
      url: res.url || '',
      public_id: res.public_id || '',
      youtube_id: res.youtube_id || '',
      order_num: res.order_num || 0,
    });
    setEditYoutubeInput(res.youtube_id || '');
  };

  const handleEditSave = async (id) => {
    setSaving(true);
    const payload = {
      topic_id: editForm.topic_id || null,
      type: editForm.type,
      title: editForm.title.trim(),
      description: editForm.description.trim() || null,
      url: editForm.url || null,
      public_id: editForm.public_id || null,
      youtube_id: editForm.youtube_id || null,
      order_num: Number(editForm.order_num) || 0,
    };
    await supabase.from('ece_resources').update(payload).eq('id', id);
    setSaving(false);
    setEditingId(null);
    loadData();
  };

  const handleEditYoutubeChange = (val) => {
    setEditYoutubeInput(val);
    const id = extractYouTubeId(val);
    setEditForm((f) => ({ ...f, youtube_id: id || '' }));
  };

  const filteredResources = filterTopic
    ? resources.filter((r) => r.topic_id === filterTopic)
    : resources;

  const typeColor = { pdf: '#ef4444', video: '#8b5cf6', career: '#f59e0b', image: '#3b82f6' };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/20 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Manage Resources</h1>
            <p className="text-xs text-slate-500">PDFs, videos, and career paths per topic</p>
          </div>
        </div>
        <button onClick={() => { setShowForm(!showForm); setForm(EMPTY_FORM); setYoutubeInput(''); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold transition-colors">
          <Plus className="w-4 h-4" /> Add Resource
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="p-5 rounded-2xl border border-white/10 bg-slate-900/60 space-y-4">
          <h2 className="text-sm font-bold text-slate-200">New Resource</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="admin-label">Topic</label>
              <select className="ece-select" value={form.topic_id} onChange={(e) => setForm((f) => ({ ...f, topic_id: e.target.value }))}>
                <option value="">General (no topic)</option>
                {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="admin-label">Type *</label>
              <select className="ece-select" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                {TYPES.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="admin-label">Title *</label>
            <input className="ece-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required placeholder="Resource title…" />
          </div>
          <div>
            <label className="admin-label">Description</label>
            <textarea className="ece-textarea" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} placeholder="Brief description…" />
          </div>
          {/* PDF / Image upload */}
          {(form.type === 'pdf' || form.type === 'image') && (
            <CloudinaryUpload
              folder={form.type === 'pdf' ? 'ece_hub/pdfs' : 'ece_hub/gallery'}
              resourceType={form.type === 'pdf' ? 'raw' : 'image'}
              accept={form.type === 'pdf' ? '.pdf' : 'image/*'}
              label={form.type === 'pdf' ? 'Upload PDF' : 'Upload Image'}
              currentUrl={form.url}
              currentPublicId={form.public_id}
              onUpload={handleFileUpload}
              onDelete={handleFileDelete}
            />
          )}
          {/* YouTube URL */}
          {form.type === 'video' && (
            <div>
              <label className="admin-label">YouTube URL</label>
              <input className="ece-input" value={youtubeInput} onChange={(e) => handleYoutubeChange(e.target.value)} placeholder="https://youtube.com/watch?v=... or video ID" />
              {form.youtube_id && <p className="text-xs text-emerald-400 mt-1">Detected ID: {form.youtube_id}</p>}
            </div>
          )}
          <div>
            <label className="admin-label">Order</label>
            <input type="number" className="ece-input" value={form.order_num} onChange={(e) => setForm((f) => ({ ...f, order_num: e.target.value }))} />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="ece-btn-primary flex items-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Create
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="ece-btn-secondary flex items-center gap-2">
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </form>
      )}

      {/* Filter by topic */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterTopic('')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${!filterTopic ? 'bg-purple-600/20 text-purple-400 border-purple-500/30' : 'text-slate-400 border-white/8 hover:bg-slate-800'}`}>
          All Topics
        </button>
        {topics.map((t) => (
          <button key={t.id} onClick={() => setFilterTopic(t.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${filterTopic === t.id ? 'bg-purple-600/20 text-purple-400 border-purple-500/30' : 'text-slate-400 border-white/8 hover:bg-slate-800'}`}>
            {t.name}
          </button>
        ))}
      </div>

      {/* Resources list */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-slate-500" /></div>
      ) : filteredResources.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">No resources. Add one above.</div>
      ) : (
        <div className="space-y-2">
          {filteredResources.map((res) => (
            <div key={res.id}>
              {/* Inline edit form */}
              {editingId === res.id ? (
                <div className="p-5 rounded-2xl border border-purple-500/30 bg-slate-900/80 space-y-4">
                  <h3 className="text-sm font-bold text-purple-300">Editing: {res.title}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="admin-label">Topic</label>
                      <select className="ece-select" value={editForm.topic_id} onChange={(e) => setEditForm((f) => ({ ...f, topic_id: e.target.value }))}>
                        <option value="">General (no topic)</option>
                        {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="admin-label">Type</label>
                      <select className="ece-select" value={editForm.type} onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))}>
                        {TYPES.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="admin-label">Title *</label>
                    <input className="ece-input" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="admin-label">Description</label>
                    <textarea className="ece-textarea" value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
                  </div>
                  {editForm.type === 'video' && (
                    <div>
                      <label className="admin-label">YouTube URL</label>
                      <input className="ece-input" value={editYoutubeInput} onChange={(e) => handleEditYoutubeChange(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
                      {editForm.youtube_id && <p className="text-xs text-emerald-400 mt-1">Detected ID: {editForm.youtube_id}</p>}
                    </div>
                  )}
                  <div>
                    <label className="admin-label">Order</label>
                    <input type="number" className="ece-input" value={editForm.order_num} onChange={(e) => setEditForm((f) => ({ ...f, order_num: e.target.value }))} />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => handleEditSave(res.id)} disabled={saving} className="ece-btn-primary flex items-center gap-2">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Save
                    </button>
                    <button onClick={() => setEditingId(null)} className="ece-btn-secondary flex items-center gap-2">
                      <X className="w-4 h-4" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* Read-only row */
                <div className="flex items-center gap-3 p-4 rounded-2xl border border-white/8 bg-slate-900/60">
                  <GripVertical className="w-4 h-4 text-slate-600 shrink-0" />
                  <div
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0"
                    style={{ background: `${typeColor[res.type] || '#3b82f6'}22`, color: typeColor[res.type] || '#3b82f6' }}
                  >
                    {res.type}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-200 truncate">{res.title}</p>
                    <p className="text-xs text-slate-500">{res.ece_topics?.name || 'No topic'}</p>
                  </div>
                  <button onClick={() => handleEditStart(res)}
                    className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors shrink-0">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(res)} disabled={deletingId === res.id}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors shrink-0">
                    {deletingId === res.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
