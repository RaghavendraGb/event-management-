import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store';
import { Users, Info, ArrowRight, KeyRound, CalendarDays, Clock } from 'lucide-react';

function StatusBadge({ status }) {
  const cls = { live: 'badge badge--live', upcoming: 'badge badge--upcoming', ended: 'badge badge--ended' }[status] || 'badge badge--ended';
  return <span className={cls}>{status === 'live' && <span className="live-dot" />}{status}</span>;
}

function MetaChip({ children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px', borderRadius: 5, fontSize: 12,
      background: 'var(--elevated)', color: 'var(--text-secondary)',
      border: '1px solid var(--border)', whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

export function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useStore((state) => state.user);

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRegistered, setIsRegistered] = useState(false);
  const [team, setTeam] = useState(null);
  const [participantCount, setParticipantCount] = useState(0);

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinMode, setJoinMode] = useState('solo');
  const [teamName, setTeamName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchDetails() {
      setLoading(true);
      const { data: evt } = await supabase.from('events').select('*').eq('id', id).single();
      if (evt) setEvent(evt);

      const { count } = await supabase
        .from('participation')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', id);
      setParticipantCount(count || 0);

      if (user && evt) {
        const { data: participation } = await supabase
          .from('participation')
          .select('id, team_id, teams(name, invite_code)')
          .eq('user_id', user.id)
          .eq('event_id', evt.id)
          .maybeSingle();

        if (participation) {
          setIsRegistered(true);
          if (participation.teams) setTeam(participation.teams);
        }
      }
      setLoading(false);
    }
    fetchDetails();
  }, [id, user]);

  const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const handleRegistrationSubmit = async (e) => {
    e.preventDefault();
    if (!user) return navigate('/login', { state: { from: `/events/${id}` } });
    setSubmitting(true);
    let finalTeamId = null;

    try {
      if (joinMode === 'create_team') {
        const code = generateCode();
        const { data: newTeam, error: teamErr } = await supabase.from('teams').insert([{
          name: teamName, event_id: event.id, invite_code: code, created_by: user.id
        }]).select().single();
        if (teamErr) throw teamErr;
        finalTeamId = newTeam.id;
        await supabase.from('team_members').insert([{ team_id: finalTeamId, user_id: user.id }]);
      } else if (joinMode === 'join_team') {
        const { data: foundTeam, error: findErr } = await supabase
          .from('teams').select('id').eq('invite_code', inviteCode).eq('event_id', event.id).single();
        if (findErr || !foundTeam) throw new Error('Invalid Invite Code for this event!');
        finalTeamId = foundTeam.id;
        await supabase.from('team_members').insert([{ team_id: finalTeamId, user_id: user.id }]);
      }

      const { error: partErr } = await supabase.from('participation').insert([{
        user_id: user.id, event_id: event.id, team_id: finalTeamId, status: 'registered'
      }]);
      if (partErr) throw partErr;
      navigate(`/lobby/${event.id}`);
    } catch (err) {
      alert(err.message);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="skeleton" style={{ height: 28, width: 300, marginBottom: 16, borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 14, width: 220, marginBottom: 28, borderRadius: 4 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
          <div className="skeleton" style={{ height: 300, borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 200, borderRadius: 8 }} />
        </div>
      </div>
    );
  }
  if (!event) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Event not found.</div>;

  const isLive = event.status === 'live';

  // Action button
  const ActionButton = () => {
    if (isRegistered) {
      if (event.results_announced || event.status === 'ended') {
        return (
          <button onClick={() => navigate(`/results/${event.id}`)} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            View Results <ArrowRight size={14} />
          </button>
        );
      }
      return (
        <button
          onClick={() => {
            const target = event.type === 'coding_challenge' ? `/live-coding/${event.id}` : isLive ? `/live/${event.id}` : `/lobby/${event.id}`;
            navigate(target);
          }}
          className="btn-primary"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {isLive ? 'Enter Live Event' : 'View Lobby'} <ArrowRight size={14} />
        </button>
      );
    }
    return (
      <button
        onClick={() => setShowJoinModal(true)}
        disabled={event.status === 'ended'}
        className="btn-primary"
        style={{ width: '100%', justifyContent: 'center' }}
      >
        {event.status === 'ended' ? 'Event Ended' : 'Register'}
      </button>
    );
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 80 }}>

      {/* Event title + meta */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, wordBreak: 'break-word' }}>
          {event.title}
        </h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <StatusBadge status={event.status} />
          <MetaChip>{event.type?.replace('_', ' ')}</MetaChip>
          <MetaChip>
            <CalendarDays size={11} />
            {new Date(event.start_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </MetaChip>
          <MetaChip>
            <Users size={11} />
            {participantCount} participants
          </MetaChip>
        </div>
      </div>

      {/* Two-col layout */}
      <div id="event-detail-grid" style={{ display: 'block' }}>
        <style>{`
          @media (min-width: 768px) {
            #event-detail-grid {
              display: grid !important;
              grid-template-columns: 1fr 300px;
              gap: 24px;
              align-items: start;
            }
          }
        `}</style>

        {/* Left: tabs */}
        <div>
          {/* Tab bar */}
          <div className="tab-bar" style={{ marginBottom: 20 }}>
            <button className="tab-item active">Details</button>
            <Link to={`/leaderboard/${event.id}`} className="tab-item">Leaderboard</Link>
          </div>

          {/* Description */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '18px 20px', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
              <Info size={14} style={{ color: 'var(--blue)' }} />
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>About</p>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, wordBreak: 'break-word' }}>
              {event.description || 'No description provided by the organizers.'}
            </p>
          </div>

          {/* Team info */}
          {isRegistered && team && (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '18px 20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                <Users size={14} style={{ color: 'var(--blue)' }} />
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Your Team</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{team.name}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Share the invite code with teammates</p>
                </div>
                <div style={{
                  background: 'var(--elevated)', border: '1px solid var(--border)',
                  borderRadius: 6, padding: '8px 14px', textAlign: 'center', flexShrink: 0,
                }}>
                  <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>Invite Code</p>
                  <p style={{ fontSize: 20, fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.2em' }}>{team.invite_code}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: sticky info panel */}
        <div style={{ position: 'sticky', top: 16 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 20 }}>
            {/* Action button */}
            <div style={{ marginBottom: 18 }}>
              <ActionButton />
            </div>

            {/* Schedule info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>Starts</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{new Date(event.start_at).toLocaleString()}</p>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>Ends</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{new Date(event.end_at).toLocaleString()}</p>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4 }}>Capacity</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {event.max_participants ? `${participantCount} / ${event.max_participants}` : 'Unlimited'}
                </p>
              </div>
              {event.max_participants && (
                <div className="progress-bar" style={{ marginTop: 4 }}>
                  <div className="progress-bar__fill" style={{ width: `${Math.min(100, (participantCount / event.max_participants) * 100)}%` }} />
                </div>
              )}
            </div>

            <Link
              to={`/leaderboard/${event.id}`}
              className="btn-ghost"
              style={{ display: 'block', textAlign: 'center', width: '100%', marginTop: 16 }}
            >
              View Leaderboard
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile sticky action bar */}
      <div id="mobile-join-bar" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--blue)', padding: '0 16px',
        height: 56, display: 'none', alignItems: 'center', justifyContent: 'center',
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 40,
      }}>
        <button
          onClick={() => isRegistered
            ? navigate(isLive ? `/live/${event.id}` : `/lobby/${event.id}`)
            : setShowJoinModal(true)
          }
          style={{
            background: 'none', border: 'none', color: '#fff', fontWeight: 600,
            fontSize: 14, cursor: 'pointer', width: '100%', height: '100%',
          }}
        >
          {isRegistered ? (isLive ? 'Enter Live Event →' : 'View Lobby →') : 'Register Now →'}
        </button>
      </div>
      <style>{`
        @media (max-width: 767px) {
          #mobile-join-bar { display: flex !important; }
        }
      `}</style>

      {/* Registration Modal */}
      {showJoinModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Register for {event.title}</p>
              <button onClick={() => setShowJoinModal(false)} style={{
                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, fontSize: 18
              }}>×</button>
            </div>

            <form onSubmit={handleRegistrationSubmit}>
              {/* Mode selection */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
                {[
                  { mode: 'solo', label: 'Solo', icon: <Users size={16} /> },
                  { mode: 'create_team', label: 'Create Team', icon: <Users size={16} /> },
                  { mode: 'join_team', label: 'Join Team', icon: <KeyRound size={16} /> },
                ].map(({ mode, label, icon }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setJoinMode(mode)}
                    style={{
                      padding: '10px 8px',
                      borderRadius: 6,
                      border: `1px solid ${joinMode === mode ? 'var(--blue)' : 'var(--border)'}`,
                      background: joinMode === mode ? 'rgba(37,99,235,0.12)' : 'var(--elevated)',
                      color: joinMode === mode ? 'var(--blue)' : 'var(--text-muted)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      cursor: 'pointer', transition: 'all 0.15s ease', fontSize: 12, fontWeight: 500,
                      minHeight: 'unset',
                    }}
                  >
                    {icon}
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Dynamic inputs */}
              <div style={{ minHeight: 70, marginBottom: 20 }}>
                {joinMode === 'solo' && (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    You'll compete as an individual. Your score will be tracked under your own name.
                  </p>
                )}
                {joinMode === 'create_team' && (
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Team Name</label>
                    <input
                      autoFocus required
                      placeholder="e.g. The Codebreakers"
                      value={teamName}
                      onChange={e => setTeamName(e.target.value)}
                      className="input"
                    />
                  </div>
                )}
                {joinMode === 'join_team' && (
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>6-Digit Invite Code</label>
                    <input
                      autoFocus required
                      minLength={6} maxLength={6}
                      placeholder="XXXXXX"
                      value={inviteCode}
                      onChange={e => setInviteCode(e.target.value.toUpperCase())}
                      className="input"
                      style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 20, letterSpacing: '0.3em' }}
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {submitting ? 'Confirming...' : 'Confirm Registration'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
