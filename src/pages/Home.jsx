import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { useStore } from '../store';
import { CalendarDays, Users, Zap, BarChart2, ArrowRight } from 'lucide-react';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate() {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric'
  });
}

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

export function Home() {
  const user = useStore((state) => state.user);
  const [stats, setStats] = useState({ events: 0, participants: 0, live: 0, avgScore: 0 });
  const [liveEvents, setLiveEvents] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [registeredIds, setRegisteredIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Fetch all stats
      const [eventsRes, liveRes] = await Promise.all([
        supabase.from('events').select('id, status, participation:participation(count)', { count: 'exact' }),
        supabase.from('events').select('*, participation:participation(count)').eq('status', 'live').order('start_at'),
      ]);

      const allEvents = eventsRes.data || [];
      const totalEvents = allEvents.length;
      const totalParticipants = allEvents.reduce((s, e) => s + (e.participation?.[0]?.count || 0), 0);
      const liveCount = allEvents.filter(e => e.status === 'live').length;

      // Avg score
      let avgScore = 0;
      const { data: scores } = await supabase.from('participation').select('score').not('score', 'is', null);
      if (scores?.length) {
        avgScore = Math.round(scores.reduce((s, p) => s + (p.score || 0), 0) / scores.length);
      }

      setStats({ events: totalEvents, participants: totalParticipants, live: liveCount, avgScore });
      setLiveEvents(liveRes.data || []);

      // Upcoming
      const { data: upcoming } = await supabase
        .from('events')
        .select('*, participation:participation(count)')
        .eq('status', 'upcoming')
        .order('start_at', { ascending: true })
        .limit(5);
      setUpcomingEvents(upcoming || []);

      // Registered IDs for current user
      if (user) {
        const { data: reg } = await supabase.from('participation').select('event_id').eq('user_id', user.id);
        setRegisteredIds(new Set((reg || []).map(r => r.event_id)));
      }

      setLoading(false);
    }
    load();
  }, [user]);

  if (loading) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Greeting skeleton */}
        <div style={{ marginBottom: 28 }}>
          <div className="skeleton" style={{ width: 220, height: 28, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: 140, height: 14 }} />
        </div>
        {/* Stats skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 28 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 80, borderRadius: 8 }} />
          ))}
        </div>
      </div>
    );
  }

  const statItems = [
    { label: 'Total Events', value: stats.events, note: 'all time', color: null },
    { label: 'Participants', value: stats.participants, note: 'across all events', color: null },
    { label: 'Live Now', value: stats.live, note: 'events running', color: stats.live > 0 ? 'var(--green)' : null },
    { label: 'Avg Score', value: stats.avgScore, note: 'platform average', color: null },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>

      {/* Greeting row */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
          {getGreeting()}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{formatDate()}</p>
      </div>

      {/* Stats strip — 4 cols laptop, 2 cols tablet/mobile */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 12,
        marginBottom: 32,
      }}>
        <style>{`
          @media (min-width: 1024px) {
            .stats-grid { grid-template-columns: repeat(4, 1fr) !important; }
          }
        `}</style>
        {statItems.map(({ label, value, note, color }) => (
          <div key={label} className="stat-card stats-grid">
            <p className="stat-card__label">{label}</p>
            <p className="stat-card__value" style={color ? { color } : {}}>
              {value}
            </p>
            <p className="stat-card__note">{note}</p>
          </div>
        ))}
      </div>

      {/* Live Now section */}
      {liveEvents.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <p className="t-section-label" style={{ marginBottom: 12 }}>Live Now</p>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            overflow: 'hidden',
          }}>
            {liveEvents.map((evt, i) => {
              const participantCount = evt.participation?.[0]?.count || 0;
              const isLast = i === liveEvents.length - 1;
              return (
                <div key={evt.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderBottom: isLast ? 'none' : '1px solid var(--border)',
                  gap: 12,
                }}>
                  <span className="live-dot" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                      {evt.title}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                      <StatusBadge status="live" />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        <Users size={11} style={{ display: 'inline', marginRight: 3 }} />
                        {participantCount} participants
                      </span>
                    </div>
                  </div>
                  <Link
                    to={`/events/${evt.id}`}
                    className="btn-primary"
                    style={{ flexShrink: 0, fontSize: 12, padding: '6px 12px' }}
                  >
                    Join
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <p className="t-section-label">Upcoming Events</p>
            <Link to="/events" style={{ fontSize: 12, color: 'var(--blue)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            overflow: 'hidden',
          }}>
            {upcomingEvents.map((evt, i) => {
              const participantCount = evt.participation?.[0]?.count || 0;
              const isReg = registeredIds.has(evt.id);
              const isLast = i === upcomingEvents.length - 1;
              return (
                <div key={evt.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderBottom: isLast ? 'none' : '1px solid var(--border)',
                  gap: 12,
                  flexWrap: 'wrap',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                      {evt.title}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                      <StatusBadge status="upcoming" />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        <CalendarDays size={11} style={{ display: 'inline', marginRight: 3 }} />
                        {new Date(evt.start_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        <Users size={11} style={{ display: 'inline', marginRight: 3 }} />
                        {participantCount}
                      </span>
                    </div>
                  </div>
                  {isReg ? (
                    <Link
                      to={`/lobby/${evt.id}`}
                      style={{
                        flexShrink: 0, fontSize: 12, padding: '6px 12px',
                        borderRadius: 6, fontWeight: 500,
                        background: 'rgba(16,185,129,0.12)',
                        color: 'var(--green)',
                        textDecoration: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Registered ✓
                    </Link>
                  ) : (
                    <Link to={`/events/${evt.id}`} className="btn-ghost" style={{ flexShrink: 0, fontSize: 12, whiteSpace: 'nowrap' }}>
                      Register
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Empty state */}
      {liveEvents.length === 0 && upcomingEvents.length === 0 && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '40px 24px',
          textAlign: 'center',
        }}>
          <CalendarDays size={28} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No active events</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Check back soon for upcoming competitions.</p>
        </div>
      )}

    </div>
  );
}
