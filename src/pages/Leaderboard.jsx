import { useParams, Link } from 'react-router-dom';
import { LiveLeaderboard } from '../components/live/LiveLeaderboard';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

function StatusBadge({ status }) {
  const cls = { live: 'badge badge--live', upcoming: 'badge badge--upcoming', ended: 'badge badge--ended' }[status] || 'badge badge--ended';
  return <span className={cls}>{status === 'live' && <span className="live-dot" />}{status}</span>;
}

export function Leaderboard() {
  const { id } = useParams();
  const [eventData, setEventData] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadEventMeta() {
      setLoadError('');
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
  }, [id]);

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
        <Link to={`/events/${id}`} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none',
          marginBottom: 12, transition: 'color 0.1s',
        }}>
          <ArrowLeft size={12} /> Back to Event
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-word', marginBottom: 6 }}>
              {eventData.title}
            </h1>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <StatusBadge status={eventData.status} />
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
        <LiveLeaderboard eventId={id} currentUserId={null} limit={20} isProjector={false} />
      </div>
    </div>
  );
}
