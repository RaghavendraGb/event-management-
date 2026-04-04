import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { QuoteDisplay } from '../../../components/ece/QuoteDisplay';
import { Quote, Plus, Trash2, Loader2, Eye, EyeOff, Check, X, Pencil } from 'lucide-react';

const CATEGORIES = ['motivation', 'exam', 'cheat', 'failure', 'inspiration'];
const EMPTY_FORM = { text: '', author: 'Anonymous', category: 'motivation', is_active: true };

export function AdminEceQuotes() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadQuotes = () => {
    supabase.from('ece_quotes').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setQuotes(data || []); setLoading(false); });
  };

  useEffect(() => { loadQuotes(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { text: form.text.trim(), author: form.author.trim() || 'Anonymous', category: form.category, is_active: form.is_active };
    if (editId) {
      await supabase.from('ece_quotes').update(payload).eq('id', editId);
    } else {
      await supabase.from('ece_quotes').insert(payload);
    }
    setSaving(false);
    setForm(EMPTY_FORM);
    setEditId(null);
    setShowForm(false);
    loadQuotes();
  };

  const handleEdit = (q) => {
    setForm({ text: q.text, author: q.author, category: q.category, is_active: q.is_active });
    setEditId(q.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this quote?')) return;
    setDeletingId(id);
    await supabase.from('ece_quotes').delete().eq('id', id);
    setDeletingId(null);
    loadQuotes();
  };

  const toggleActive = async (q) => {
    await supabase.from('ece_quotes').update({ is_active: !q.is_active }).eq('id', q.id);
    loadQuotes();
  };

  const catColor = { motivation: '#3b82f6', exam: '#f59e0b', cheat: '#8b5cf6', failure: '#ef4444', inspiration: '#10b981' };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Preview */}
      <div className="p-4 rounded-2xl border border-white/8 bg-slate-900/60">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Live Preview</p>
        <QuoteDisplay />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 flex items-center justify-center">
            <Quote className="w-5 h-5 text-indigo-400" />
          </div>
          <h1 className="text-xl font-black text-white">Manage Quotes</h1>
        </div>
        <button onClick={() => { setShowForm(!showForm); setForm(EMPTY_FORM); setEditId(null); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-colors">
          <Plus className="w-4 h-4" /> Add Quote
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="p-5 rounded-2xl border border-white/10 bg-slate-900/60 space-y-4">
          <h2 className="text-sm font-bold text-slate-200">{editId ? 'Edit Quote' : 'New Quote'}</h2>
          <div>
            <label className="admin-label">Quote Text *</label>
            <textarea className="ece-textarea" value={form.text} onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))} required rows={3} placeholder='"The real grade is what you know…"' />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="admin-label">Author</label>
              <input className="ece-input" value={form.author} onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))} placeholder="Anonymous" />
            </div>
            <div>
              <label className="admin-label">Category</label>
              <select className="ece-select" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="quoteActive" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4" />
            <label htmlFor="quoteActive" className="text-sm text-slate-300">Active (shown in display)</label>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="ece-btn-primary flex items-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {editId ? 'Update' : 'Add'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} className="ece-btn-secondary flex items-center gap-2">
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </form>
      )}

      {/* Quotes list */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-slate-500" /></div>
      ) : quotes.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">No quotes yet.</div>
      ) : (
        <div className="space-y-3">
          {quotes.map((q) => (
            <div key={q.id} className={`p-4 rounded-2xl border border-white/8 bg-slate-900/60 ${!q.is_active ? 'opacity-50' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                      style={{ background: `${catColor[q.category] || '#3b82f6'}22`, color: catColor[q.category] || '#3b82f6' }}>
                      {q.category}
                    </span>
                    {!q.is_active && <span className="text-[10px] font-bold text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full">Inactive</span>}
                  </div>
                  <p className="text-sm text-slate-200 italic">"{q.text}"</p>
                  <p className="text-xs text-slate-500 mt-1">— {q.author}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => toggleActive(q)} title={q.is_active ? 'Deactivate' : 'Activate'}
                    className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-white transition-colors">
                    {q.is_active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => handleEdit(q)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-amber-400 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(q.id)} disabled={deletingId === q.id}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors">
                    {deletingId === q.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
