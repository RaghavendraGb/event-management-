import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Trophy, Medal, Share2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store';

export function Profile() {
  const { userId } = useParams();
  const currentUser = useStore((state) => state.user);
  const targetUserId = userId || currentUser?.id;

  const [profile, setProfile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      if (!targetUserId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data: userData } = await supabase
        .from('users')
        .select('id, name, email, college, avatar_url, created_at')
        .eq('id', targetUserId)
        .single();

      const { data: rows } = await supabase
        .from('participation')
        .select('id, event_id, score, status, registered_at, events(id, title, type)')
        .eq('user_id', targetUserId)
        .order('registered_at', { ascending: false });

      const safeRows = rows || [];
      const submitted = safeRows.filter((r) => r.status === 'submitted' && r.events?.id);

      const ranks = await Promise.all(
        submitted.map(async (r) => {
          const { count } = await supabase
            .from('participation')
            .select('id', { count: 'exact', head: true })
            .eq('event_id', r.events.id)
            .gt('score', r.score || 0);
          return {
            ...r,
            rank: (count || 0) + 1,
          };
        })
      );

      setProfile(userData || null);
      setEntries(ranks);
      setLoading(false);
    }

    loadProfile();
  }, [targetUserId]);

  const stats = useMemo(() => {
    const totalJoined = entries.length;
    const bestScore = entries.reduce((m, e) => Math.max(m, e.score || 0), 0);
    const wins = entries.filter((e) => e.rank === 1).length;
    const top3 = entries.filter((e) => e.rank <= 3).length;
    const bestRank = totalJoined > 0 ? Math.min(...entries.map((e) => e.rank)) : null;
    return { totalJoined, bestScore, wins, top3, bestRank };
  }, [entries]);

  const badges = useMemo(() => {
    const b = [];
    if (stats.totalJoined >= 1) b.push('First Steps');
    if (stats.totalJoined >= 5) b.push('Consistent Competitor');
    if (stats.top3 >= 1) b.push('Podium Finish');
    if (stats.wins >= 1) b.push('Champion');
    if (stats.bestScore >= 100) b.push('Century Club');
    return b;
  }, [stats]);

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/profile/${targetUserId || ''}`
    : '';

  const handleShare = async () => {
    if (!shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile?.name || 'Participant'} - Achievement Profile`,
          text: 'Check my competition profile and achievements.',
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to clipboard below.
      }
    }
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <div className="skeleton" style={{ width: 220, height: 28, marginBottom: 10 }} />
        <div className="skeleton" style={{ width: 320, height: 14, marginBottom: 24 }} />
        <div className="skeleton" style={{ width: '100%', height: 180, borderRadius: 12 }} />
      </div>
    );
  }

  if (!targetUserId) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', padding: '24px 12px' }}>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 14 }}>Sign in to view your achievement profile.</p>
        <Link to="/login" className="btn-primary">Go to Login</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gap: 16 }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
            {profile?.name || 'Participant'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {profile?.college || 'Competition Member'}
          </p>
        </div>
        <button className="btn-ghost" onClick={handleShare} style={{ minWidth: 180, justifyContent: 'center' }}>
          {copied ? <CheckCircle2 size={14} /> : <Share2 size={14} />}
          {copied ? 'Copied Link' : 'Share Profile'}
        </button>
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }} id="profile-stats-grid">
        {[
          { label: 'Events', value: stats.totalJoined },
          { label: 'Best Score', value: stats.bestScore },
          { label: 'Wins', value: stats.wins },
          { label: 'Best Rank', value: stats.bestRank ? `#${stats.bestRank}` : '—' },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <p className="stat-card__label">{s.label}</p>
            <p className="stat-card__value">{s.value}</p>
          </div>
        ))}
      </div>

      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 16,
      }}>
        <p className="t-section-label" style={{ marginBottom: 10 }}>Badges</p>
        {badges.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No badges yet. Join and complete events to unlock achievements.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {badges.map((badge) => (
              <span key={badge} className="badge badge--blue">
                <Medal size={11} /> {badge}
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 16,
      }}>
        <p className="t-section-label" style={{ marginBottom: 12 }}>Recent Achievements</p>
        {entries.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No completed events to show yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {entries.slice(0, 10).map((e) => (
              <div
                key={e.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{e.events?.title}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {new Date(e.registered_at).toLocaleDateString()}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge badge--upcoming">
                    <Trophy size={11} /> #{e.rank}
                  </span>
                  <span className="badge badge--live">{e.score || 0} pts</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 767px) {
          #profile-stats-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
