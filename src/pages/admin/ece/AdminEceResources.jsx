import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { deleteFromCloudinary } from '../../../lib/cloudinary';
import { CloudinaryUpload } from '../../../components/ece/CloudinaryUpload';
import { extractYouTubeId } from '../../../lib/youtube';
import { BookOpen, Plus, Trash2, Loader2, X, Check, GripVertical, Pencil } from 'lucide-react';

const TYPES = ['pdf', 'video', 'career', 'image'];
const EMPTY_FORM = { topic_id: '', type: 'pdf', title: '', description: '', url: '', public_id: '', youtube_id: '', order_num: 0 };

const Label = ({ children }) => (
  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
    {children}
  </label>
);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Manage Resources</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>Curate PDFs, videos, and career materials for the ECE Hub.</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setForm(EMPTY_FORM); setYoutubeInput(''); }}
          className="btn-primary" style={{ padding: '10px 20px', textTransform: 'uppercase', fontSize: 12 }}>
          <Plus size={16} /> Add Resource
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <form onSubmit={handleSubmit} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '4px solid var(--blue)', borderRadius: 12, padding: 24, marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>New Resource</h2>
            <button type="button" onClick={() => setShowForm(false)} style={{ color: 'var(--text-muted)' }} className="hover-white">
              <X size={20} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <Label>Topic</Label>
              <select style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-primary)', fontSize: 13 }}
                value={form.topic_id} onChange={(e) => setForm((f) => ({ ...f, topic_id: e.target.value }))}>
                <option value="">General (no topic)</option>
                {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Type</Label>
              <select style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-primary)', fontSize: 13 }}
                value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                {TYPES.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
              </select>
            </div>
          </div>

          <div>
            <Label>Title</Label>
            <input required style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-primary)', fontSize: 13 }}
              value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Resource title…" />
          </div>

          <div>
            <Label>Description</Label>
            <textarea rows={2} style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-primary)', fontSize: 13, resize: 'none' }}
              value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Brief description…" />
          </div>

          {/* PDF / Image upload */}
          {(form.type === 'pdf' || form.type === 'image') && (
            <div style={{ padding: 16, background: 'rgba(59,130,246,0.03)', border: '1px solid var(--border)', borderRadius: 12 }}>
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
            </div>
          )}

          {/* YouTube URL */}
          {form.type === 'video' && (
            <div style={{ padding: 16, background: 'rgba(168,85,247,0.03)', border: '1px solid var(--border)', borderRadius: 12 }}>
              <Label>YouTube URL / Video ID</Label>
              <input style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-primary)', fontSize: 13 }}
                value={youtubeInput} onChange={(e) => handleYoutubeChange(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
              {form.youtube_id && <p style={{ fontSize: 10, color: 'var(--green)', fontWeight: 700, marginTop: 8, textTransform: 'uppercase' }}>Detected ID: {form.youtube_id}</p>}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <Label>Internal Order</Label>
              <input type="number" style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-primary)', fontSize: 13 }}
                value={form.order_num} onChange={(e) => setForm((f) => ({ ...f, order_num: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 1, padding: '10px 0' }}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Deploy
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Filter by topic */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
        <button onClick={() => setFilterTopic('')}
          className="btn-ghost"
          style={{ 
            fontSize: 11,
            background: !filterTopic ? 'var(--blue)' : 'var(--elevated)',
            color: !filterTopic ? '#fff' : 'var(--text-muted)'
          }}>
          All Topics
        </button>
        {topics.map((t) => (
          <button key={t.id} onClick={() => setFilterTopic(t.id)}
            className="btn-ghost"
            style={{ 
              fontSize: 11,
              background: filterTopic === t.id ? 'var(--blue)' : 'var(--elevated)',
              color: filterTopic === t.id ? '#fff' : 'var(--text-muted)'
            }}>
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
                <div style={{ background: 'var(--surface)', border: '1px solid var(--blue)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--blue)' }}>Editing: {res.title}</h3>
                    <button onClick={() => setEditingId(null)} style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <Label>Topic</Label>
                      <select style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, color: 'var(--text-primary)', fontSize: 12 }}
                        value={editForm.topic_id} onChange={(e) => setEditForm((f) => ({ ...f, topic_id: e.target.value }))}>
                        <option value="">General</option>
                        {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label>Type</Label>
                      <select style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, color: 'var(--text-primary)', fontSize: 12 }}
                        value={editForm.type} onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))}>
                        {TYPES.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label>Title</Label>
                    <input style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, color: 'var(--text-primary)', fontSize: 13 }}
                      value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
                  </div>

                  {editForm.type === 'video' && (
                    <div>
                      <Label>YouTube URL</Label>
                      <input style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, color: 'var(--text-primary)', fontSize: 13 }}
                        value={editYoutubeInput} onChange={(e) => handleEditYoutubeChange(e.target.value)} />
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <Label>Order</Label>
                      <input type="number" style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, color: 'var(--text-primary)', fontSize: 13 }}
                        value={editForm.order_num} onChange={(e) => setEditForm((f) => ({ ...f, order_num: e.target.value }))} />
                    </div>
                    <button onClick={() => handleEditSave(res.id)} disabled={saving} className="btn-primary" style={{ padding: '8px 24px', fontSize: 12 }}>
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
                    </button>
                  </div>
                </div>
              ) : (
                /* Read-only row */
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <GripVertical size={14} style={{ color: 'var(--text-muted)', cursor: 'grab', shrink: 0 }} />
                  <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', shrink: 0 }}>
                    <BookOpen size={16} style={{ color: typeColor[res.type] || 'var(--blue)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{res.title}</p>
                      <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: 'var(--elevated)', color: typeColor[res.type] || 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{res.type}</span>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{res.ece_topics?.name || 'General Resource'}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => handleEditStart(res)} className="btn-ghost" style={{ padding: 8, minHeight: 'unset' }}>
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(res)} disabled={deletingId === res.id} className="btn-ghost" style={{ padding: 8, minHeight: 'unset', color: 'var(--red)' }}>
                      {deletingId === res.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
