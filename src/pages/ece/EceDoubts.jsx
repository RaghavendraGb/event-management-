import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { DoubtForm } from '../../components/ece/DoubtForm';
import { useStore } from '../../store';
import { HelpCircle, CheckCircle2, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Loader2 } from 'lucide-react';

export function EceDoubts() {
  const user = useStore((state) => state.user);
  const [doubts, setDoubts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  const loadDoubts = () => {
    supabase
      .from('ece_doubts')
      .select('id, topic_id, message, admin_reply, is_resolved, created_at, sender_id, ece_topics(name)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setDoubts(data || []);
        setLoading(false);
      });
  };

  useEffect(() => { loadDoubts(); }, []);

  // Realtime: re-fetch on INSERT (new doubt) or UPDATE (admin reply/resolve)
  useEffect(() => {
    const channel = supabase
      .channel('ece_doubts_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ece_doubts' },
        () => { loadDoubts(); }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ece_doubts' },
        () => { loadDoubts(); }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-blue-500/20 flex items-center justify-center">
          <HelpCircle className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-black text-white">Doubt Box</h1>
          <p className="text-xs text-slate-500">Submit anonymously — admin replies are public</p>
        </div>
      </div>

      {/* Submission form */}
      <div className="p-5 rounded-2xl border border-white/8 bg-slate-900/60">
        <h2 className="text-sm font-bold text-slate-200 mb-4">Submit a Doubt</h2>
        <DoubtForm onSubmitted={loadDoubts} />
      </div>

      {/* Doubts list */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">All Doubts</h2>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
          </div>
        ) : doubts.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            No doubts submitted yet. Be the first!
          </div>
        ) : (
          doubts.map((doubt) => {
            const isMe = doubt.sender_id === user?.id;
            const isExpanded = expanded === doubt.id;
            return (
              <div
                key={doubt.id}
                className={`
                  p-4 rounded-2xl border transition-all cursor-pointer
                  ${isMe ? 'border-blue-500/25 bg-blue-500/5' : 'border-white/8 bg-slate-900/40'}
                `}
                onClick={() => setExpanded(isExpanded ? null : doubt.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        {doubt.ece_topics?.name || 'General'}
                      </span>
                      {isMe && (
                        <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full">
                          Your doubt
                        </span>
                      )}
                      {doubt.is_resolved && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Resolved
                        </span>
                      )}
                      <span className="text-[10px] text-slate-600 flex items-center gap-0.5">
                        <Clock className="w-3 h-3" /> {formatDate(doubt.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      <span className="text-slate-500 font-semibold">Anonymous: </span>
                      {doubt.message}
                    </p>
                    {doubt.admin_reply && isExpanded && (
                      <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <p className="text-[10px] font-bold text-emerald-400 mb-1">Admin Reply:</p>
                        <p className="text-xs text-slate-300 leading-relaxed">{doubt.admin_reply}</p>
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-1">
                    {doubt.admin_reply && (
                      <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full mr-1">
                        Reply
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
