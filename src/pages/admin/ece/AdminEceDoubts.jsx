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

  useEffect(() => { loadData(); }, []);

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
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-blue-500/20 flex items-center justify-center">
          <HelpCircle className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-black text-white">Manage Doubts</h1>
          <p className="text-xs text-slate-500">You can see who sent each doubt. Students see Anonymous.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all capitalize ${filter === f ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' : 'text-slate-400 border-white/8 hover:bg-slate-800'}`}>
            {f}
          </button>
        ))}
        <select value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)} className="ece-select text-xs py-1.5 h-auto min-h-0">
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
            <div key={doubt.id} className="p-5 rounded-2xl border border-white/8 bg-slate-900/60 space-y-3">
              {/* Meta */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
                  {doubt.sender?.name || 'Unknown'} &lt;{doubt.sender?.email}&gt;
                </span>
                <span className="text-xs text-slate-500">{doubt.ece_topics?.name || 'General'}</span>
                <span className="text-xs text-slate-600">{formatDate(doubt.created_at)}</span>
                {doubt.is_resolved ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> Resolved
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                    <Circle className="w-3 h-3" /> Pending
                  </span>
                )}
              </div>

              {/* Doubt message */}
              {editDoubtId === doubt.id ? (
                <div className="space-y-2">
                  <textarea className="ece-textarea" value={editDoubtText} onChange={(e) => setEditDoubtText(e.target.value)} rows={3} />
                  <div className="flex gap-2">
                    <button onClick={() => handleEditDoubt(doubt.id)} disabled={saving} className="ece-btn-primary text-xs flex items-center gap-1">
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
                    </button>
                    <button onClick={() => setEditDoubtId(null)} className="ece-btn-secondary text-xs flex items-center gap-1"><X className="w-3 h-3" /> Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-300 leading-relaxed">{doubt.message}</p>
              )}

              {/* Admin reply */}
              {doubt.admin_reply && replyId !== doubt.id && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-[10px] font-bold text-emerald-400 mb-1">Your Reply:</p>
                  <p className="text-xs text-slate-300">{doubt.admin_reply}</p>
                </div>
              )}

              {replyId === doubt.id && (
                <div className="space-y-2">
                  <textarea className="ece-textarea" value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={3} placeholder="Type your reply…" />
                  <div className="flex gap-2">
                    <button onClick={() => handleReply(doubt.id)} disabled={saving} className="ece-btn-primary text-xs flex items-center gap-1">
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Post Reply
                    </button>
                    <button onClick={() => setReplyId(null)} className="ece-btn-secondary text-xs flex items-center gap-1"><X className="w-3 h-3" /> Cancel</button>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => { setReplyId(doubt.id); setReplyText(doubt.admin_reply || ''); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {doubt.admin_reply ? 'Edit Reply' : 'Reply'}
                </button>
                <button onClick={() => { setEditDoubtId(doubt.id); setEditDoubtText(doubt.message); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors">
                  <Pencil className="w-3.5 h-3.5" /> Edit Doubt
                </button>
                <button onClick={() => handleResolve(doubt)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${doubt.is_resolved ? 'bg-slate-700 text-slate-400 hover:bg-slate-600' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {doubt.is_resolved ? 'Unresolve' : 'Mark Resolved'}
                </button>
                <button onClick={() => handleDelete(doubt.id)} disabled={deletingId === doubt.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors ml-auto">
                  {deletingId === doubt.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
