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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Intelligence Feed</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>Monitor real-time communication logs and administrative chat history.</p>
        </div>
        <button onClick={handleExportCSV}
          className="btn-ghost" style={{ padding: '10px 20px', background: 'var(--elevated)' }}>
          <Download size={16} /> Data Export (CSV)
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 24 }}>
        <input
          style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 20px', color: 'var(--text-primary)', fontSize: 14 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter logs by operator / content…"
        />
      </div>

      {/* Messages */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-slate-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">No messages found.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((msg) => (
            <div key={msg.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', shrink: 0 }}>
                {msg.sender_name?.charAt(0)}
              </div>
              
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{msg.sender_name}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{formatTime(msg.created_at)}</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{msg.message}</p>
              </div>

              <button onClick={() => handleDelete(msg.id)} disabled={deletingId === msg.id}
                className="btn-ghost" style={{ padding: 8, minHeight: 'unset', color: 'var(--red)', shrink: 0 }}>
                {deletingId === msg.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
