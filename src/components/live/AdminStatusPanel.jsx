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
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle2 size={12} /> Completed
        </span>
      );
    }
    if (p.violations >= 3) {
      return (
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--red)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={12} /> Ejected
        </span>
      );
    }
    if (p.answered === 0) {
      return (
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Activity size={12} /> Idle
        </span>
      );
    }
    return (
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--blue)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Activity size={12} className="live-dot" style={{ animation: 'pulse 2s infinite' }} /> Active
      </span>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '24px 0', justifyContent: 'center', color: 'var(--text-muted)' }}>
        <div style={{ width: 16, height: 16, border: '2px solid var(--elevated)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontSize: 13 }}>Syncing live participation...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
        {[
          { label: 'Total',       value: total,          color: 'var(--text-primary)' },
          { label: 'In Progress', value: active,         color: 'var(--blue)' },
          { label: 'Completed',   value: submitted,      color: 'var(--green)' },
          { label: 'Violations',  value: withViolations, color: 'var(--red)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, textAlign: 'center' }}>
            <p style={{ fontSize: 24, fontWeight: 700, color }}>{value}</p>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginTop: 4 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Participant list */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 100px', gap: 12, padding: '12px 16px', background: 'var(--elevated)', borderBottom: '1px solid var(--border)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
          <span>Participant</span>
          <span style={{ textAlign: 'center' }}>Progress</span>
          <span style={{ textAlign: 'center' }}>Strikes</span>
          <span style={{ textAlign: 'right' }}>Status</span>
        </div>

        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {participants.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No active participants
            </div>
          ) : (
            participants.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 80px 80px 100px',
                  gap: 12,
                  padding: '12px 16px',
                  alignItems: 'center',
                  borderBottom: '1px solid var(--border)'
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>

                <span style={{ fontSize: 13, fontWeight: 700, textAlign: 'center' }}>
                  <span style={{ color: p.answered === totalQuestions ? 'var(--green)' : 'var(--text-primary)' }}>{p.answered}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>/{totalQuestions || '?'}</span>
                </span>

                <span style={{ fontSize: 13, fontWeight: 700, textAlign: 'center', color: p.violations >= 3 ? 'var(--red)' : p.violations > 0 ? 'var(--amber)' : 'var(--text-muted)' }}>
                  {p.violations > 0 ? `⚠ ${p.violations}` : '—'}
                </span>

                <div style={{ textAlign: 'right' }}>{getStatusBadge(p)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-muted)', padding: '0 4px' }}>
        <Activity size={14} style={{ color: 'var(--green)' }} />
        Live stream active via Supabase Realtime
      </div>
    </div>
  );
}
