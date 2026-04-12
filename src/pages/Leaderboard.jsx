import { useParams, Link } from 'react-router-dom';
import { LiveLeaderboard } from '../components/live/LiveLeaderboard';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function StatusBadge({ status }) {
  const cls = { live: 'badge badge--live', upcoming: 'badge badge--upcoming', ended: 'badge badge--ended' }[status] || 'badge badge--ended';
  return <span className={cls}>{status === 'live' && <span className="live-dot" />}{status}</span>;
}

export function Leaderboard() {
  const { id } = useParams();
  const [eventData, setEventData] = useState(null);
  const [publicRows, setPublicRows] = useState([]);
  const [loadError, setLoadError] = useState('');

  const isPublicBoard = id === 'public';
  const isEventIdValid = UUID_RE.test(String(id || ''));

  useEffect(() => {
    let active = true;

    async function loadEventMeta() {
      setLoadError('');

      if (isPublicBoard) {
        const { data, error } = await supabase
          .from('participation')
          .select('user_id, score, users(name, avatar_url), events(title)')
          .not('score', 'is', null)
          .order('score', { ascending: false })
          .limit(100);

        if (!active) return;
        if (error) {
          setLoadError(error.message || 'Unable to load public leaderboard right now.');
          return;
        }

        setPublicRows(data || []);
        setEventData({ title: 'Public Leaderboard', type: 'global', status: 'live', sponsor_logo_url: null });
        return;
      }

      if (!isEventIdValid) {
        setLoadError('Invalid leaderboard link. Please open leaderboard from an event page.');
        return;
      }

      const { data, error } = await supabase
        .from('events')
        .select('title, type, status, sponsor_logo_url')
        .eq('id', id)
        .single();

      if (!active) return;
      if (error || !data) {
        setLoadError(error?.message || 'Unable to load leaderboard right now.');
        return;
      }
      setEventData(data);
    }

    loadEventMeta().catch((err) => {
      if (!active) return;
      console.error('LEADERBOARD_META_LOAD_ERROR', err);
      setLoadError('Unable to load leaderboard right now.');
    });

    return () => {
      active = false;
    };
  }, [id, isPublicBoard, isEventIdValid]);

  if (loadError) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid rgba(245,158,11,0.28)',
          borderRadius: 10,
          padding: 16,
          color: 'var(--text-secondary)',
        }}>
          {loadError}
        </div>
      </div>
    );
  }

  if (!eventData) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="skeleton" style={{ height: 28, width: 240, marginBottom: 8, borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 400, borderRadius: 8 }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <Link to={isPublicBoard ? '/events' : `/events/${id}`} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none',
          marginBottom: 12, transition: 'color 0.1s',
        }}>
          <ArrowLeft size={12} /> {isPublicBoard ? 'Back to Events' : 'Back to Event'}
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-word', marginBottom: 6 }}>
              {eventData.title}
            </h1>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {!isPublicBoard && <StatusBadge status={eventData.status} />}
              <span className="badge" style={{ background: 'var(--elevated)', color: 'var(--text-muted)' }}>
                {eventData.type?.replace('_', ' ')}
              </span>
            </div>
          </div>
          {eventData.sponsor_logo_url && (
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 4 }}>
                Powered by
              </p>
              <img src={eventData.sponsor_logo_url} alt="Sponsor" style={{ height: 40, objectFit: 'contain' }} />
            </div>
          )}
        </div>
      </div>

      {/* Leaderboard table */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        {isPublicBoard ? (
          <div style={{ padding: 16, display: 'grid', gap: 10 }}>
            {publicRows.map((row, idx) => (
              <div key={`${row.user_id}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--elevated)' }}>
                <div style={{ width: 28, height: 28, borderRadius: 4, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'var(--text-muted)' }}>
                  {idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.users?.name || 'Participant'}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.events?.title || 'Event'}</p>
                </div>
                <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--green)' }}>{Number(row.score || 0)}</p>
              </div>
            ))}
            {publicRows.length === 0 && (
              <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)' }}>No public leaderboard entries yet.</div>
            )}
          </div>
        ) : (
          <LiveLeaderboard eventId={id} currentUserId={null} limit={20} isProjector={false} />
        )}
      </div>
    </div>
  );
}
