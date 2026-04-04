import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { MessageSquare, Trash2, Loader2, Download } from 'lucide-react';

export function AdminEceChat() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [search, setSearch] = useState('');
  const bottomRef = useRef(null);

  const loadMessages = () => {
    supabase.from('ece_chat').select('*').order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => { setMessages(data || []); setLoading(false); });
  };

  useEffect(() => { loadMessages(); }, []);

  // Real-time subscription — update state from payload, not full re-fetch
  useEffect(() => {
    const channel = supabase.channel('admin_ece_chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ece_chat' }, (payload) => {
        setMessages((prev) => {
          // Admin view is ordered descending (newest first), so prepend
          const next = [payload.new, ...prev];
          return next.slice(0, 200);
        });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'ece_chat' }, (payload) => {
        setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this message?')) return;
    setDeletingId(id);
    await supabase.from('ece_chat').delete().eq('id', id);
    setDeletingId(null);
    // DELETE realtime event handles state update (requires REPLICA IDENTITY FULL - FIX 5)
  };

  const handleExportCSV = () => {
    const headers = 'Sender,Message,Time\n';
    const rows = messages.map((m) =>
      `"${m.sender_name}","${m.message.replace(/"/g, '""')}","${new Date(m.created_at).toLocaleString('en-IN')}"`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ece_chat_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

  const filtered = search
    ? messages.filter((m) => m.sender_name.toLowerCase().includes(search.toLowerCase()) || m.message.toLowerCase().includes(search.toLowerCase()))
    : messages;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Chat Monitor</h1>
            <p className="text-xs text-slate-500">{messages.length} messages</p>
          </div>
        </div>
        <button onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-bold transition-colors">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Search */}
      <input
        className="ece-input"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by sender or message…"
      />

      {/* Messages */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-slate-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">No messages found.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((msg) => (
            <div key={msg.id} className="flex items-start gap-3 p-3 rounded-xl border border-white/8 bg-slate-900/60 hover:bg-slate-900/80 transition-colors">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0 uppercase">
                {msg.sender_name?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-baseline gap-2 mb-0.5">
                  <span className="text-xs font-bold text-slate-300">{msg.sender_name}</span>
                  <span className="text-[10px] text-slate-600">{formatTime(msg.created_at)}</span>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed break-words">{msg.message}</p>
              </div>
              <button onClick={() => handleDelete(msg.id)} disabled={deletingId === msg.id}
                className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-colors shrink-0">
                {deletingId === msg.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
