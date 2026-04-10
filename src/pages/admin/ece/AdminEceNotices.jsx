import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { NoticeCard } from '../../../components/ece/NoticeCard';
import { Bell, Plus, Trash2, Loader2, Eye, EyeOff, Check, X, Pencil } from 'lucide-react';

const TYPES = ['info', 'urgent', 'exam', 'lab', 'event'];
const EMPTY_FORM = { title: '', content: '', type: 'info', expires_at: '', is_active: true };

const Label = ({ children }) => (
  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
    {children}
  </label>
);

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
      .then(({ data }) => {
        setNotices(data || []);
        setLoading(false);
      });
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Bulletin Control</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Broadcast urgent announcements and academic schedules.</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setForm(EMPTY_FORM); setEditId(null); }}
          className="btn-primary" style={{ padding: '10px 20px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
          <Plus size={16} /> New Broadcast
        </button>
      </div>

      {/* Form Section */}
      {showForm && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 32, animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{editId ? 'Architecting Notice' : 'Initialize Broadcast'}</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Configure headline and operational visibility.</p>
            </div>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} className="btn-ghost" style={{ padding: 8, minHeight: 'unset' }}>
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
              <div>
                <Label>Notice Headline *</Label>
                <input required className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Brief but descriptive title…" />
              </div>
              <div>
                <Label>Notice Category</Label>
                <select className="select" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                  {TYPES.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                </select>
              </div>
            </div>

            <div>
              <Label>Detailed Message Content *</Label>
              <textarea required className="input" style={{ resize: 'none' }} value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} rows={4} placeholder="Full announcement detail and instructions…" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <Label>Automatic Expiry Date</Label>
                <input type="date" className="input" value={form.expires_at} onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 20 }}>
                <input type="checkbox" id="noticeActive" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                <label htmlFor="noticeActive" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer' }}>Immediate Broadcast (Public Visibility)</label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowForm(false); setEditId(null); }} type="button" className="btn-ghost" style={{ padding: '10px 24px' }}>Discard</button>
              <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '10px 32px' }}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} 
                {editId ? 'Verify & Update Bulletin' : 'Publish to Feed'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Announcements registry */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h3 style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Historical Bulletin Registry</h3>
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-500" /></div>
        ) : notices.length === 0 ? (
          <div style={{ textAlign: 'center', py: 64, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 48 }}>
            <Bell size={32} style={{ color: 'var(--text-muted)', marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No notices archived. Bulletin feed is currently clear.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {notices.map((notice) => (
              <div key={notice.id} style={{ position: 'relative', transition: 'transform 0.2s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateX(4px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateX(0)'}>
                <div style={{ opacity: notice.is_active ? 1 : 0.5 }}>
                  <NoticeCard notice={notice} />
                </div>
                {/* Admin actions overlay */}
                <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 6 }}>
                  <button onClick={() => toggleActive(notice)} className="btn-ghost" style={{ padding: 8, minHeight: 'unset', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 10 }} title={notice.is_active ? 'Hide Bulletin' : 'Show Bulletin'}>
                    {notice.is_active ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button onClick={() => handleEdit(notice)} className="btn-ghost" style={{ padding: 8, minHeight: 'unset', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 10 }} title="Edit">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => handleDelete(notice.id)} disabled={deletingId === notice.id} className="btn-ghost" style={{ padding: 8, minHeight: 'unset', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--red)' }} title="Delete">
                    {deletingId === notice.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
