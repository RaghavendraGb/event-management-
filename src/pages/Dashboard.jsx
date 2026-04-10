import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { Trophy, CalendarDays, Activity, Star, ExternalLink } from 'lucide-react';

function StatusBadge({ status }) {
  const cls = {
    live: 'badge badge--live',
    upcoming: 'badge badge--upcoming',
    ended: 'badge badge--ended',
  }[status] || 'badge badge--ended';
  return (
    <span className={cls}>
      {status === 'live' && <span className="live-dot" />}
      {status}
    </span>
  );
}

export function Dashboard() {
  const user = useStore((state) => state.user);
  const [participations, setParticipations] = useState([]);
  const [stats, setStats] = useState({ joined: 0, bestScore: 0, bestRank: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      if (!user) return;

      const { data, error } = await supabase
        .from('participation')
        .select(`
          id, score, status, registered_at,
          events (id, title, type, status, start_at, end_at)
        `)
        .eq('user_id', user.id)
        .order('registered_at', { ascending: false });

      if (data && !error) {
        setParticipations(data);
        const maxScore = data.reduce((max, p) => p.score > max ? p.score : max, 0);

        let bestRank = null;
        const submittedParticipations = data.filter(p => p.status === 'submitted' && p.events?.id);

        if (submittedParticipations.length > 0) {
          const rankPromises = submittedParticipations.map(async (p) => {
            const { count } = await supabase
              .from('participation')
              .select('id', { count: 'exact', head: true })
              .eq('event_id', p.events.id)
              .gt('score', p.score || 0);
            return (count || 0) + 1;
          });
          const ranks = await Promise.all(rankPromises);
          bestRank = ranks.reduce((best, r) => (r < best ? r : best), Infinity);
          if (bestRank === Infinity) bestRank = null;
        }

        setStats({ joined: data.length, bestScore: maxScore, bestRank });
      }
      setLoading(false);
    }
    loadDashboard();
  }, [user]);

  if (loading) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="skeleton" style={{ width: 200, height: 26, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: 280, height: 14, marginBottom: 28 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 28 }}>
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 8 }} />)}
        </div>
      </div>
    );
  }

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : null;

  const maxScore = stats.bestScore || 100;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            {user?.name || 'Dashboard'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {memberSince ? `Member since ${memberSince}` : ''}
            {stats.joined > 0 ? ` · ${stats.joined} event${stats.joined !== 1 ? 's' : ''} joined` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to={`/profile/${user?.id}`} className="btn-ghost" style={{ flexShrink: 0 }}>
            Public Profile
          </Link>
          <Link to="/events" className="btn-primary" style={{ flexShrink: 0 }}>
            Find Events
          </Link>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 32 }}>
        <style>{`@media (min-width: 1024px) { .dash-stats { grid-template-columns: repeat(4, 1fr) !important; } }`}</style>
        {[
          { label: 'Events Joined', value: stats.joined, note: 'total', color: null },
          { label: 'Best Score', value: stats.bestScore, note: 'across all events', color: 'var(--blue)' },
          { label: 'Active Live', value: participations.filter(p => p.events?.status === 'live').length, note: 'right now', color: null },
          { label: 'Best Rank', value: stats.bestRank ? `#${stats.bestRank}` : '—', note: 'highest achieved', color: null },
        ].map(({ label, value, note, color }) => (
          <div key={label} className="stat-card dash-stats">
            <p className="stat-card__label">{label}</p>
            <p className="stat-card__value" style={color ? { color } : {}}>{value}</p>
            <p className="stat-card__note">{note}</p>
          </div>
        ))}
      </div>

      {/* Events table */}
      <div>
        <p className="t-section-label" style={{ marginBottom: 12 }}>My Events</p>

        {participations.length === 0 ? (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
            padding: '40px 24px', textAlign: 'center',
          }}>
            <CalendarDays size={28} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No events joined yet</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Browse the event catalog and join your first competition.</p>
            <Link to="/events" className="btn-primary" style={{ display: 'inline-flex' }}>Browse Events</Link>
          </div>
        ) : (
          <>
            {/* Table on laptop */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
              display: 'none',
            }} id="dash-table">
              <table className="data-table" style={{ display: 'table', tableLayout: 'auto' }}>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Score</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {participations.map((p) => {
                    const scorePercent = maxScore > 0 ? Math.min(100, ((p.score || 0) / maxScore) * 100) : 0;
                    return (
                      <tr key={p.id}>
                        <td>
                          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                            {p.events?.title}
                          </p>
                          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                            {p.events?.type?.replace('_', ' ')}
                          </p>
                        </td>
                        <td>
                          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.score || 0}</p>
                          <div className="progress-bar" style={{ width: 80, marginTop: 4 }}>
                            <div className="progress-bar__fill" style={{ width: `${scorePercent}%` }} />
                          </div>
                        </td>
                        <td><StatusBadge status={p.events?.status} /></td>
                        <td>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {new Date(p.registered_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        </td>
                        <td>
                          <Link to={`/lobby/${p.events?.id}`} className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}>
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Card list on mobile */}
            <div id="dash-cards">
              {participations.map((p) => (
                <div key={p.id} style={{
                  padding: '14px 16px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  marginBottom: 8,
                  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                        {p.events?.title}
                      </p>
                      <StatusBadge status={p.events?.status} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {p.events?.type?.replace('_', ' ')}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Score: <strong style={{ color: 'var(--text-primary)' }}>{p.score || 0}</strong></span>
                    </div>
                  </div>
                  <Link to={`/lobby/${p.events?.id}`} className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px', flexShrink: 0 }}>
                    View
                  </Link>
                </div>
              ))}
            </div>

            <style>{`
              @media (min-width: 768px) {
                #dash-table { display: block !important; }
                #dash-cards { display: none !important; }
              }
            `}</style>
          </>
        )}
      </div>
    </div>
  );
}
