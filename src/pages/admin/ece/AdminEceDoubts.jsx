import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  HelpCircle, Trash2, Loader2, CheckCircle2, Circle, Filter, MessageSquare, Pencil, Check, X
} from 'lucide-react';

const FILTERS = ['all', 'unresolved', 'resolved'];

export function AdminEceDoubts() {
  const [doubts, setDoubts] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [topicFilter, setTopicFilter] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [replyId, setReplyId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [editDoubtId, setEditDoubtId] = useState(null);
  const [editDoubtText, setEditDoubtText] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = () => {
    Promise.all([
      supabase.from('ece_doubts').select('*, sender:users(name, email), ece_topics(name)').order('created_at', { ascending: false }),
      supabase.from('ece_topics').select('id, name').order('order_num'),
    ]).then(([doubtsRes, topicsRes]) => {
      setDoubts(doubtsRes.data || []);
      setTopics(topicsRes.data || []);
      setLoading(false);
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const formatDate = (d) => d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this doubt?')) return;
    setDeletingId(id);
    await supabase.from('ece_doubts').delete().eq('id', id);
    setDeletingId(null);
    loadData();
  };

  const handleReply = async (id) => {
    setSaving(true);
    await supabase.from('ece_doubts').update({ admin_reply: replyText.trim(), updated_at: new Date().toISOString() }).eq('id', id);
    setSaving(false);
    setReplyId(null);
    setReplyText('');
    loadData();
  };

  const handleResolve = async (doubt) => {
    await supabase.from('ece_doubts').update({ is_resolved: !doubt.is_resolved }).eq('id', doubt.id);
    loadData();
  };

  const handleEditDoubt = async (id) => {
    setSaving(true);
    await supabase.from('ece_doubts').update({ message: editDoubtText.trim() }).eq('id', id);
    setSaving(false);
    setEditDoubtId(null);
    setEditDoubtText('');
    loadData();
  };

  const filtered = doubts.filter((d) => {
    const matchFilter = filter === 'all' || (filter === 'unresolved' && !d.is_resolved) || (filter === 'resolved' && d.is_resolved);
    const matchTopic = !topicFilter || d.topic_id === topicFilter;
    return matchFilter && matchTopic;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Doubt Resolution</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>Monitor and respond to student queries from the ECE Hub.</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className="btn-ghost"
              style={{ 
                fontSize: 11,
                background: filter === f ? 'var(--blue)' : 'var(--elevated)',
                color: filter === f ? '#fff' : 'var(--text-muted)'
              }}>
              {f}
            </button>
          ))}
        </div>
        <select style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', color: 'var(--text-primary)', fontSize: 12 }}
          value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)}>
          <option value="">All Topics</option>
          {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {/* Doubts */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-slate-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">No doubts match the filter.</div>
      ) : (
        <div className="space-y-4">
          {filtered.map((doubt) => (
            <div key={doubt.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Meta */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                      {doubt.sender?.name || 'Anonymous User'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{doubt.ece_topics?.name || 'General'}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', borderLeft: '1px solid var(--border)', paddingLeft: 8 }}>{formatDate(doubt.created_at)}</span>
                  </div>
                  {doubt.is_resolved ? (
                    <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--green)', padding: '2px 8px', borderRadius: 4, background: 'rgba(16,185,129,0.1)', textTransform: 'uppercase' }}>Resolved</span>
                  ) : (
                    <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--amber)', padding: '2px 8px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', textTransform: 'uppercase' }}>Unresolved</span>
                  )}
                </div>

                {/* Doubt message */}
                <div style={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
                   {editDoubtId === doubt.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <textarea style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: 12, color: 'var(--text-primary)', fontSize: 13, resize: 'none' }}
                        value={editDoubtText} onChange={(e) => setEditDoubtText(e.target.value)} rows={3} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => handleEditDoubt(doubt.id)} disabled={saving} className="btn-primary" style={{ padding: '6px 16px', fontSize: 11 }}>
                          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
                        </button>
                        <button onClick={() => setEditDoubtId(null)} className="btn-ghost" style={{ padding: '6px 16px', fontSize: 11 }}><X size={12} /> Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: 14, color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>{doubt.message}</p>
                  )}
                </div>

                {/* Admin reply */}
                {doubt.admin_reply && replyId !== doubt.id && (
                  <div style={{ borderLeft: '3px solid var(--green)', paddingLeft: 16, marginTop: 8 }}>
                    <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--green)', textTransform: 'uppercase', marginBottom: 4 }}>Official Response</p>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>{doubt.admin_reply}</p>
                  </div>
                )}

                {replyId === doubt.id && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                    <textarea style={{ width: '100%', background: 'var(--elevated)', border: '1px solid var(--green)', borderRadius: 8, padding: 12, color: 'var(--text-primary)', fontSize: 13, resize: 'none' }}
                      value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={3} placeholder="Type your reply…" />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleReply(doubt.id)} disabled={saving} className="btn-primary" style={{ padding: '8px 24px', fontSize: 12 }}>
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Post Response
                      </button>
                      <button onClick={() => setReplyId(null)} className="btn-ghost" style={{ padding: '8px 16px', fontSize: 12 }}><X size={14} /> Cancel</button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <button onClick={() => { setReplyId(doubt.id); setReplyText(doubt.admin_reply || ''); }}
                    className="btn-ghost" style={{ padding: '8px 16px', fontSize: 11, background: 'var(--elevated)' }}>
                    <MessageSquare size={14} style={{ color: 'var(--blue)' }} />
                    {doubt.admin_reply ? 'Edit Response' : 'Reply'}
                  </button>
                  <button onClick={() => { setEditDoubtId(doubt.id); setEditDoubtText(doubt.message); }}
                    className="btn-ghost" style={{ padding: '8px 16px', fontSize: 11 }}>
                    <Pencil size={14} /> Edit Source
                  </button>
                  <button onClick={() => handleResolve(doubt)}
                    className="btn-ghost" style={{ padding: '8px 16px', fontSize: 11, background: doubt.is_resolved ? 'var(--elevated)' : 'transparent' }}>
                    <CheckCircle2 size={14} style={{ color: doubt.is_resolved ? 'var(--text-muted)' : 'var(--green)' }} />
                    {doubt.is_resolved ? 'Unresolve' : 'Resolve'}
                  </button>
                  <button onClick={() => handleDelete(doubt.id)} disabled={deletingId === doubt.id}
                    className="btn-ghost" style={{ padding: '8px 16px', fontSize: 11, color: 'var(--red)', marginLeft: 'auto' }}>
                    {deletingId === doubt.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Delete
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
