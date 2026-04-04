import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, CheckCircle2, AlertTriangle, WifiOff, Activity } from 'lucide-react';

/**
 * AdminStatusPanel — Feature 3
 * Shown inside AdminEvents when an event is live and expanded.
 * Real-time view of who is answering, who is idle, who disconnected.
 */
export function AdminStatusPanel({ eventId, totalQuestions }) {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const fetchParticipants = useCallback(async () => {
    const { data } = await supabase
      .from('participation')
      .select('id, user_id, answers, violations, status, users(id, name)')
      .eq('event_id', eventId);

    if (!data || !isMountedRef.current) return;

    const enriched = data.map((p) => {
      const answeredCount = p.answers ? Object.keys(p.answers).length : 0;
      return {
        id: p.id,
        name: p.users?.name || `User ${p.user_id?.slice(0, 6)}`,
        answered: answeredCount,
        violations: p.violations || 0,
        status: p.status || 'active',
      };
    });

    setParticipants(enriched);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchParticipants();

    const channel = supabase
      .channel(`admin-status-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'participation',
          filter: `event_id=eq.${eventId}`,
        },
        () => fetchParticipants() // re-fetch on any update
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [eventId, fetchParticipants]);

  const total = participants.length;
  const submitted = participants.filter((p) => p.status === 'submitted').length;
  const active = participants.filter((p) => p.status === 'active' || p.status === 'registered').length;
  const withViolations = participants.filter((p) => p.violations > 0).length;

  const getStatusBadge = (p) => {
    if (p.status === 'submitted') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3" /> Completed
        </span>
      );
    }
    if (p.violations >= 3) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-500/20 text-red-400 border border-red-500/30">
          <AlertTriangle className="w-3 h-3" /> Ejected
        </span>
      );
    }
    // answered === 0 and not submitted = registered but not started
    if (p.answered === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-500/20 text-slate-400 border border-slate-500/30">
          <Activity className="w-3 h-3" /> Not Started
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-500/20 text-blue-400 border border-blue-500/30">
        <Activity className="w-3 h-3" /> In Progress
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-6 justify-center text-slate-500">
        <div className="w-5 h-5 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
        Loading participant status...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',       value: total,          color: 'text-white' },
          { label: 'In Progress', value: active,         color: 'text-blue-400' },
          { label: 'Completed',   value: submitted,      color: 'text-emerald-400' },
          { label: 'Violations',  value: withViolations, color: 'text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-900/60 border border-white/5 rounded-xl p-3 text-center">
            <p className={`text-xl font-black ${color}`}>{value}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{label}</p>
          </div>
        ))}
      </div>

      {/* Participant table */}
      <div className="border border-white/5 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-4 py-2 bg-slate-950/60 text-[10px] font-black uppercase tracking-widest text-slate-500">
          <span>Participant</span>
          <span className="text-center">Answered</span>
          <span className="text-center">Violations</span>
          <span className="text-center">Status</span>
        </div>

        <div className="divide-y divide-white/[0.04] max-h-72 overflow-y-auto">
          {participants.length === 0 ? (
            <div className="flex items-center gap-3 py-8 justify-center text-slate-500">
              <Users className="w-5 h-5" />
              No participants yet
            </div>
          ) : (
            participants.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-4 py-3 items-center hover:bg-slate-900/40 transition-colors"
              >
                <span className="text-sm font-medium text-slate-200 truncate">{p.name}</span>

                <span className="text-sm font-bold text-center min-w-[48px]">
                  <span className={p.answered === totalQuestions ? 'text-emerald-400' : 'text-slate-300'}>
                    {p.answered}
                  </span>
                  <span className="text-slate-600">/{totalQuestions || '?'}</span>
                </span>

                <span className={`text-sm font-bold text-center min-w-[32px] ${
                  p.violations >= 3 ? 'text-red-400' : p.violations > 0 ? 'text-amber-400' : 'text-slate-500'
                }`}>
                  {p.violations > 0 ? `⚠ ${p.violations}` : '—'}
                </span>

                <div className="min-w-[90px] text-right">{getStatusBadge(p)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-600">
        <Activity className="w-3.5 h-3.5 text-emerald-500" />
        Live updates via Supabase realtime
      </div>
    </div>
  );
}
