import { useState, useEffect } from 'react';
import { Send, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store';

/**
 * Anonymous doubt submission form.
 * Student selects a topic, types doubt, submits.
 * Displayed as "Anonymous" to peers but tracked by sender_id for admin.
 */
export function DoubtForm({ onSubmitted }) {
  const user = useStore((state) => state.user);
  const [topics, setTopics] = useState([]);
  const [topicId, setTopicId] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase
      .from('ece_topics')
      .select('id, name')
      .order('order_num')
      .then(({ data }) => setTopics(data || []));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    setError(null);

    const { error: err } = await supabase.from('ece_doubts').insert({
      sender_id: user.id,
      topic_id: topicId || null,
      message: message.trim(),
    });

    setSubmitting(false);
    if (err) {
      setError(err.message);
    } else {
      setSubmitted(true);
      setMessage('');
      setTopicId('');
      onSubmitted?.();
      setTimeout(() => setSubmitted(false), 4000);
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
        <p className="text-sm text-emerald-300">Your doubt has been submitted anonymously!</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
          Topic (optional)
        </label>
        <select
          value={topicId}
          onChange={(e) => setTopicId(e.target.value)}
          className="ece-select"
        >
          <option value="">General / No topic</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
          Your Doubt *
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="ece-textarea"
          rows={4}
          placeholder="Ask anything about the topic — it will be shown anonymously..."
          required
          maxLength={1000}
        />
        <p className="text-[10px] text-slate-600 mt-1 text-right">{message.length}/1000</p>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting || !message.trim()}
        className="ece-btn-primary flex items-center gap-2 w-full justify-center"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Submit Anonymously
      </button>
    </form>
  );
}
