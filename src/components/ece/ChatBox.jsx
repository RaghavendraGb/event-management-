import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Loader2, Check, Clock3, WifiOff } from 'lucide-react';
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
  const [realtimeStatus, setRealtimeStatus] = useState('connecting');
  const bottomRef = useRef(null);
  const outboxRef = useRef([]);

  const appendOrMergeIncoming = useCallback((incoming) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === incoming.id)) return prev;

      const optimisticIdx = prev.findIndex(
        (m) =>
          m._optimistic &&
          m.sender_id === incoming.sender_id &&
          m.message === incoming.message
      );

      if (optimisticIdx !== -1) {
        const next = [...prev];
        next[optimisticIdx] = { ...incoming, _status: 'sent' };
        return next.slice(-MAX_MESSAGES);
      }

      return [...prev, { ...incoming, _status: 'sent' }].slice(-MAX_MESSAGES);
    });
  }, []);

  const loadLatestMessages = useCallback(async () => {
    const { data } = await supabase
      .from('ece_chat')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(MAX_MESSAGES);

    const sorted = (data || []).slice().reverse();
    setMessages((prev) => {
      const localPending = prev.filter((m) => m._optimistic && m._status !== 'sent');
      return [...sorted, ...localPending].slice(-MAX_MESSAGES);
    });
    setLoading(false);
  }, []);

  const pushOptimisticMessage = (text, status = 'sending') => {
    const optimistic = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sender_id: user.id,
      sender_name: user.name || user.email || 'Anon',
      message: text,
      created_at: new Date().toISOString(),
      _optimistic: true,
      _status: status,
    };

    setMessages((prev) => [...prev, optimistic].slice(-MAX_MESSAGES));
    return optimistic;
  };

  const markMessageStatus = (tempId, status) => {
    setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, _status: status } : m)));
  };

  const sendToServer = useCallback(async (text, tempId) => {
    const { data, error } = await supabase
      .from('ece_chat')
      .insert({
        sender_id: user.id,
        sender_name: user.name || user.email || 'Anon',
        message: text,
      })
      .select('*')
      .single();

    if (error) {
      markMessageStatus(tempId, 'failed');
      return false;
    }

    appendOrMergeIncoming(data);
    return true;
  }, [appendOrMergeIncoming, user]);

  const flushOutbox = useCallback(async () => {
    if (!navigator.onLine || outboxRef.current.length === 0) return;

    const pending = [...outboxRef.current];
    outboxRef.current = [];

    for (const item of pending) {
      const ok = await sendToServer(item.text, item.tempId);
      if (!ok) {
        outboxRef.current.push(item);
      }
    }
  }, [sendToServer]);

  // Load initial messages
  useEffect(() => {
    loadLatestMessages();
  }, [loadLatestMessages]);

  // Subscribe to real-time inserts
  useEffect(() => {
    const channel = supabase
      .channel(`ece_chat_realtime_${user?.id || 'guest'}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ece_chat' },
        (payload) => {
          appendOrMergeIncoming(payload.new);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'ece_chat' },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
          flushOutbox();
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeStatus('reconnecting');
        }
      });

    return () => supabase.removeChannel(channel);
  }, [appendOrMergeIncoming, flushOutbox, user?.id]);

  useEffect(() => {
    const reconnectAndSync = () => {
      setRealtimeStatus('connected');
      loadLatestMessages();
      flushOutbox();
    };

    window.addEventListener('online', reconnectAndSync);
    return () => window.removeEventListener('online', reconnectAndSync);
  }, [flushOutbox, loadLatestMessages]);

  useEffect(() => {
    if (realtimeStatus === 'reconnecting') {
      const poll = setInterval(() => {
        loadLatestMessages();
      }, 3000);
      return () => clearInterval(poll);
    }
    return undefined;
  }, [loadLatestMessages, realtimeStatus]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !user) return;
    setInput('');

    const optimistic = pushOptimisticMessage(text, navigator.onLine ? 'sending' : 'queued');

    if (!navigator.onLine) {
      outboxRef.current.push({ text, tempId: optimistic.id });
      return;
    }

    setSending(true);
    const ok = await sendToServer(text, optimistic.id);
    if (!ok) {
      outboxRef.current.push({ text, tempId: optimistic.id });
    }
    setSending(false);
  };

  const retryMessage = async (msg) => {
    markMessageStatus(msg.id, 'sending');
    const ok = await sendToServer(msg.message, msg.id);
    if (!ok) {
      outboxRef.current.push({ text: msg.message, tempId: msg.id });
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  return (
    <div className="chat-box">
      <div className="chat-header">
        <div>
          <p className="chat-title">ECE Community</p>
          <p className="chat-subtitle">Instant group chat</p>
        </div>
        <span className={`chat-connection-badge ${realtimeStatus === 'connected' ? 'online' : 'reconnecting'}`}>
          {realtimeStatus === 'connected' ? <Check size={12} /> : <WifiOff size={12} />}
          {realtimeStatus === 'connected' ? 'Live' : 'Syncing'}
        </span>
      </div>

      {/* Messages area */}
      <div className="chat-messages custom-scrollbar">
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="chat-empty">No messages yet. Start the conversation!</div>
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
              <span className="chat-time" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {formatTime(msg.created_at)}
                {isMe && msg._status === 'sending' && <Clock3 size={11} />}
                {isMe && msg._status === 'queued' && <WifiOff size={11} />}
                {isMe && msg._status === 'failed' && (
                  <button
                    onClick={() => retryMessage(msg)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--red)', fontSize: 10, cursor: 'pointer', padding: 0 }}
                  >
                    retry
                  </button>
                )}
              </span>
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
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Type a message…"
          maxLength={500}
          disabled={sending && !navigator.onLine}
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
