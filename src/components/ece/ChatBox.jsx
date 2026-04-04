import { useEffect, useRef, useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store';

const MAX_MESSAGES = 100;

/**
 * Real-time community chat using Supabase Realtime.
 * Subscribes to ece_chat table postgres_changes.
 */
export function ChatBox() {
  const user = useStore((state) => state.user);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  // Load initial messages
  useEffect(() => {
    supabase
      .from('ece_chat')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(MAX_MESSAGES)
      .then(({ data }) => {
        setMessages(data || []);
        setLoading(false);
      });
  }, []);

  // Subscribe to real-time inserts
  useEffect(() => {
    const channel = supabase
      .channel('ece_chat_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ece_chat' },
        (payload) => {
          setMessages((prev) => {
            const next = [...prev, payload.new];
            return next.slice(-MAX_MESSAGES);
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'ece_chat' },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !user) return;
    setSending(true);
    setInput('');

    await supabase.from('ece_chat').insert({
      sender_id: user.id,
      sender_name: user.name || user.email || 'Anon',
      message: text,
    });
    setSending(false);
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  return (
    <div className="chat-box">
      {/* Messages area */}
      <div className="chat-messages custom-scrollbar">
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-sm">
            No messages yet. Start the conversation!
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.sender_id === user?.id;
          return (
            <div
              key={msg.id}
              className={`chat-msg ${isMe ? 'chat-msg--me' : 'chat-msg--other'}`}
            >
              {!isMe && (
                <span className="chat-sender">{msg.sender_name}</span>
              )}
              <div className={`chat-bubble ${isMe ? 'chat-bubble--me' : 'chat-bubble--other'}`}>
                {msg.message}
              </div>
              <span className="chat-time">{formatTime(msg.created_at)}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <input
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Type a message…"
          maxLength={500}
          disabled={sending}
        />
        <button
          onClick={sendMessage}
          disabled={sending || !input.trim()}
          className="chat-send-btn"
          aria-label="Send message"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
