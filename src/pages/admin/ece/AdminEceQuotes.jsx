import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { QuoteDisplay } from '../../../components/ece/QuoteDisplay';
import { Quote, Plus, Trash2, Loader2, Eye, EyeOff, Check, X, Pencil, Save, RefreshCw } from 'lucide-react';

const CATEGORIES = ['motivation', 'exam', 'cheat', 'failure', 'inspiration'];
const EMPTY_FORM = { text: '', author: 'Anonymous', category: 'motivation', is_active: true };

export function AdminEceQuotes() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const Label = ({ children }) => (
    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
      {children}
    </label>
  );

  const loadQuotes = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('ece_quotes').select('*').order('created_at', { ascending: false });
    setQuotes(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadQuotes(); }, [loadQuotes]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { 
      text: form.text.trim(), 
      author: form.author.trim() || 'Anonymous', 
      category: form.category, 
      is_active: form.is_active 
    };

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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this inspirational asset?')) return;
    setDeletingId(id);
    await supabase.from('ece_quotes').delete().eq('id', id);
    setDeletingId(null);
    loadQuotes();
  };

  const toggleActive = async (q) => {
    await supabase.from('ece_quotes').update({ is_active: !q.is_active }).eq('id', q.id);
    loadQuotes();
  };

  const CAT_COLORS = {
    motivation:  { bg: 'rgba(59,130,246,0.1)',  text: '#3b82f6' },
    exam:        { bg: 'rgba(245,158,11,0.1)',  text: '#f59e0b' },
    cheat:       { bg: 'rgba(139,92,246,0.1)',  text: '#8b5cf6' },
    failure:     { bg: 'rgba(239,68,68,0.1)',   text: '#ef4444' },
    inspiration: { bg: 'rgba(16,185,129,0.1)',  text: '#10b981' },
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8 pb-32">
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Inspiration Controller</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Curate and manage motivational assets for the rotational ECE hub display.</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={loadQuotes} className="btn-ghost" style={{ padding: 10 }}>
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          {!showForm && (
            <button onClick={() => { setShowForm(true); setForm(EMPTY_FORM); setEditId(null); }}
              className="btn-primary" style={{ padding: '10px 24px', background: 'var(--blue)', color: '#000', fontWeight: 800 }}>
              <Plus size={16} /> Asset Initialization
            </button>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: showForm ? '400px 1fr' : '1fr', gap: 32, alignItems: 'flex-start' }}>
        
        {/* Left: Input Form */}
        {showForm && (
          <div style={{ position: 'sticky', top: 32 }}>
            <form onSubmit={handleSubmit} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '4px solid var(--blue)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase' }}>{editId ? 'Modify Record' : 'New Entry'}</h3>
                <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
              </div>

              <div>
                <Label>Content Directive</Label>
                <textarea required rows={4}
                  style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, color: 'var(--text-primary)', fontSize: 14, resize: 'none', lineHeight: 1.6 }}
                  value={form.text} onChange={(e) => setForm(f => ({ ...f, text: e.target.value }))}
                  placeholder='"The real grade is what you know..."' />
              </div>

              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <Label>Identity Attribution</Label>
                  <input style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, color: 'var(--text-primary)', fontSize: 13 }}
                    value={form.author} onChange={(e) => setForm(f => ({ ...f, author: e.target.value }))} placeholder="Anonymous" />
                </div>
                <div>
                  <Label>Contextual Tag</Label>
                  <select style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, color: 'var(--text-primary)', fontSize: 13, fontWeight: 700 }}
                    value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <input type="checkbox" id="quoteActive" checked={form.is_active} onChange={(e) => setForm(f => ({ ...f, is_active: e.target.checked }))} style={{ width: 16, height: 16, accentColor: 'var(--blue)' }} />
                <label htmlFor="quoteActive" style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', cursor: 'pointer', textTransform: 'uppercase' }}>Live Deployment Status</label>
              </div>

              <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '14px 0', background: 'var(--blue)', color: '#000', fontWeight: 900 }}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
                {editId ? 'Commit Changes' : 'Initialize Asset'}
              </button>
            </form>

            <div style={{ marginTop: 24, padding: 20, background: 'rgba(59,130,246,0.03)', border: '1px solid var(--border)', borderRadius: 16 }}>
               <Label>Current System Preview</Label>
               <div style={{ marginTop: 12, padding: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
                  <QuoteDisplay />
               </div>
            </div>
          </div>
        )}

        {/* Right: Asset Inventory */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {!showForm && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, display: 'flex', alignItems: 'center', gap: 24 }}>
               <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Quote size={20} style={{ color: 'var(--blue)' }} />
               </div>
               <div style={{ flex: 1 }}>
                  <Label>Live Rotational Display</Label>
                  <QuoteDisplay />
               </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
               <h3 style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Registry Inventory ({quotes.length})</h3>
               <div style={{ height: 1, flex: 1, background: 'var(--border)', margin: '0 16px' }} />
            </div>

            {loading && quotes.length === 0 ? (
               <div style={{ padding: 64, textAlign: 'center' }}><Loader2 size={32} className="animate-spin" style={{ margin: '0 auto', color: 'var(--text-muted)' }} /></div>
            ) : quotes.length === 0 ? (
               <div style={{ padding: 64, textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, borderStyle: 'dashed' }}>
                  <Quote size={40} style={{ color: 'var(--text-muted)', opacity: 0.2, margin: '0 auto 24px' }} />
                  <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Registry Empty</p>
               </div>
            ) : (
              quotes.map((q) => (
                <div key={q.id} style={{ 
                    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px', 
                    opacity: q.is_active ? 1 : 0.5, borderLeft: q.is_active ? `4px solid ${CAT_COLORS[q.category]?.text || 'var(--blue)'}` : '4px solid var(--text-muted)',
                    transition: 'all 0.2s'
                  }}
                  className="row-hover"
                >
                  <div style={{ display: 'flex', gap: 20 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 10px', borderRadius: 6, background: CAT_COLORS[q.category]?.bg, color: CAT_COLORS[q.category]?.text, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {q.category}
                        </span>
                        {!q.is_active && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 10px', borderRadius: 6, background: 'var(--elevated)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Inactive</span>}
                      </div>
                      <p style={{ fontSize: 15, color: 'var(--text-primary)', fontStyle: 'italic', fontWeight: 500, lineHeight: 1.6 }}>"{q.text}"</p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>— {q.author}</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <button onClick={() => toggleActive(q)} className="btn-ghost" style={{ padding: 10, borderRadius: 10 }} title={q.is_active ? 'Deactivate' : 'Activate'}>
                        {q.is_active ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button onClick={() => handleEdit(q)} className="btn-ghost" style={{ padding: 10, borderRadius: 10 }} title="Modify">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => handleDelete(q.id)} disabled={deletingId === q.id} className="btn-ghost" style={{ padding: 10, borderRadius: 10, color: 'var(--red)' }} title="Purge Record">
                        {deletingId === q.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
