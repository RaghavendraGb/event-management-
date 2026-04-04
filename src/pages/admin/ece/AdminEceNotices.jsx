import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { NoticeCard } from '../../../components/ece/NoticeCard';
import { Bell, Plus, Trash2, Loader2, Eye, EyeOff, Check, X, Pencil } from 'lucide-react';

const TYPES = ['info', 'urgent', 'exam', 'lab', 'event'];
const EMPTY_FORM = { title: '', content: '', type: 'info', expires_at: '', is_active: true };

export function AdminEceNotices() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadNotices = () => {
    supabase.from('ece_notices').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setNotices(data || []); setLoading(false); });
  };

  useEffect(() => { loadNotices(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      type: form.type,
      is_active: form.is_active,
      expires_at: form.expires_at || null,
    };
    if (editId) {
      await supabase.from('ece_notices').update(payload).eq('id', editId);
    } else {
      await supabase.from('ece_notices').insert(payload);
    }
    setSaving(false);
    setForm(EMPTY_FORM);
    setEditId(null);
    setShowForm(false);
    loadNotices();
  };

  const handleEdit = (notice) => {
    setForm({ ...notice, expires_at: notice.expires_at ? notice.expires_at.slice(0, 10) : '' });
    setEditId(notice.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this notice?')) return;
    setDeletingId(id);
    await supabase.from('ece_notices').delete().eq('id', id);
    setDeletingId(null);
    loadNotices();
  };

  const toggleActive = async (notice) => {
    await supabase.from('ece_notices').update({ is_active: !notice.is_active }).eq('id', notice.id);
    loadNotices();
  };

  const typeColor = { info: '#3b82f6', urgent: '#ef4444', exam: '#f59e0b', lab: '#8b5cf6', event: '#10b981' };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center">
            <Bell className="w-5 h-5 text-amber-400" />
          </div>
          <h1 className="text-xl font-black text-white">Manage Notices</h1>
        </div>
        <button onClick={() => { setShowForm(!showForm); setForm(EMPTY_FORM); setEditId(null); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold transition-colors">
          <Plus className="w-4 h-4" /> Add Notice
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="p-5 rounded-2xl border border-white/10 bg-slate-900/60 space-y-4">
          <h2 className="text-sm font-bold text-slate-200">{editId ? 'Edit Notice' : 'New Notice'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="admin-label">Title *</label>
              <input className="ece-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required placeholder="Notice title…" />
            </div>
            <div>
              <label className="admin-label">Type</label>
              <select className="ece-select" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                {TYPES.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="admin-label">Content *</label>
            <textarea className="ece-textarea" value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} required rows={4} placeholder="Notice content…" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="admin-label">Expires At (optional)</label>
              <input type="date" className="ece-input" value={form.expires_at} onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))} />
            </div>
            <div className="flex items-center gap-3 pt-5">
              <input type="checkbox" id="noticeActive" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4" />
              <label htmlFor="noticeActive" className="text-sm text-slate-300">Active (visible to students)</label>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="ece-btn-primary flex items-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {editId ? 'Update' : 'Post'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} className="ece-btn-secondary flex items-center gap-2">
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </form>
      )}

      {/* Notices list */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-slate-500" /></div>
      ) : notices.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">No notices yet.</div>
      ) : (
        <div className="space-y-3">
          {notices.map((notice) => (
            <div key={notice.id} className={`relative ${!notice.is_active ? 'opacity-50' : ''}`}>
              <NoticeCard notice={notice} />
              {/* Admin actions overlay */}
              <div className="absolute top-3 right-3 flex gap-1">
                <button onClick={() => toggleActive(notice)} title={notice.is_active ? 'Deactivate' : 'Activate'}
                  className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                  {notice.is_active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => handleEdit(notice)} className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(notice.id)} disabled={deletingId === notice.id}
                  className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors">
                  {deletingId === notice.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
