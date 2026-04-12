import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Trophy, Users, User, Radio, Clock } from 'lucide-react';

export function LiveLeaderboard({ eventId, currentUserId, limit = 10, isProjector = false }) {
  const [entries, setEntries] = useState([]);
  const [tab, setTab] = useState('solo');
  const [teamsEnabled, setTeamsEnabled] = useState(false);
  const [eventMeta, setEventMeta] = useState(null);
  // Feature 6: stable mode — 'live' updates instantly; 'stable' snapshots every 2s
  const [mode, setMode] = useState(isProjector ? 'stable' : 'live');
  const stableSnapshotRef = useRef([]);   // last stable snapshot
  const [stableEntries, setStableEntries] = useState([]); // displayed in stable mode
  const stableIntervalRef = useRef(null);

  // Fix #4: throttle timer ref — batches rapid score updates into one re-render
  const updateThrottleRef = useRef(null);
  const pendingScoreUpdates = useRef({});  // { participationId: newScore }

  useEffect(() => {
    let alive = true;
    supabase
      .from('events')
      .select('id, type, quiz_mode, rapid_fire_style')
      .eq('id', eventId)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        setEventMeta(data || null);
      });
    return () => {
      alive = false;
    };
  }, [eventId]);

  const fetchBoard = useCallback(async () => {
    if (eventMeta?.type === 'quiz' && eventMeta?.quiz_mode === 'competitive') {
      const { data: players } = await supabase
        .from('competitive_quiz_player_state')
        .select('user_id, total_score, status')
        .eq('event_id', eventId)
        .neq('status', 'disqualified')
        .order('total_score', { ascending: false });

      const playerRows = players || [];
      const userIds = [...new Set(playerRows.map(p => p.user_id).filter(Boolean))];
      let userMap = {};
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, name, avatar_url')
          .in('id', userIds);
        if (users) users.forEach(u => { userMap[u.id] = u; });
      }

      const enrichedCompetitive = playerRows.map((p) => ({
        id: `cq-${p.user_id}`,
        user_id: p.user_id,
        team_id: null,
        score: Number(p.total_score || 0),
        name: userMap[p.user_id]?.name || 'Participant',
        avatar: userMap[p.user_id]?.avatar_url || null,
        teamName: null,
        isMe: p.user_id === currentUserId,
      }));

      setTeamsEnabled(false);
      setEntries(enrichedCompetitive);
      return;
    }

    if (eventMeta?.type === 'treasure_hunt') {
      const { data: players } = await supabase
        .from('treasure_hunt_player_state')
        .select('user_id, current_stage, attempts, finish_rank, status')
        .eq('event_id', eventId);

      const rows = players || [];
      const userIds = [...new Set(rows.map(p => p.user_id).filter(Boolean))];
      let userMap = {};
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, name, avatar_url')
          .in('id', userIds);
        if (users) users.forEach(u => { userMap[u.id] = u; });
      }

      const enrichedTreasure = rows
        .map((p) => ({
          id: `th-${p.user_id}`,
          user_id: p.user_id,
          team_id: null,
          score: Number((p.finish_rank ? (10000 - Number(p.finish_rank)) : 0) + (Number(p.current_stage || 0) * 100) - Number(p.attempts || 0)),
          name: userMap[p.user_id]?.name || 'Participant',
          avatar: userMap[p.user_id]?.avatar_url || null,
          teamName: null,
          isMe: p.user_id === currentUserId,
        }))
        .sort((a, b) => b.score - a.score);

      setTeamsEnabled(false);
      setEntries(enrichedTreasure);
      return;
    }

    const { data: parts } = await supabase
      .from('participation')
      .select('id, user_id, team_id, score, teams(name)')
      .eq('event_id', eventId);

    if (!parts) return;

    const userIds = [...new Set(parts.map(p => p.user_id).filter(Boolean))];
    let userMap = {};
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, name, avatar_url')
        .in('id', userIds);
      if (users) {
        users.forEach(u => { userMap[u.id] = u; });
      }
    }

    const enriched = (parts || []).map(p => ({
      id: p.id,
      user_id: p.user_id,
      team_id: p.team_id,
      score: p.score || 0,
      name: userMap[p.user_id]?.name || `Participant`,
      avatar: userMap[p.user_id]?.avatar_url || null,
      teamName: p.teams?.name || null,
      isMe: p.user_id === currentUserId,
    }));

    setEntries(enriched);
    if (enriched.some(e => e.team_id)) setTeamsEnabled(true);
  }, [eventId, currentUserId, eventMeta?.type, eventMeta?.quiz_mode]);

  useEffect(() => {
    const initialFetchTimer = setTimeout(() => {
      fetchBoard();
    }, 0);

    const isRealtimeConnectedRef = { current: false };
    // Fix #3: track prior disconnect so we can re-sync on reconnect
    const wasDisconnected = { current: false };
    let pollerTimer = null;

    const channel = supabase.channel(`leaderboard-${eventId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'participation',
        filter: `event_id=eq.${eventId}`
      }, (payload) => {
        if (eventMeta?.type === 'quiz' && eventMeta?.quiz_mode === 'competitive') {
          fetchBoard();
          return;
        }
        if (eventMeta?.type === 'treasure_hunt') {
          fetchBoard();
          return;
        }
        const { id: participationId, score } = payload.new;

        // Check if we need a full re-hydration (name still placeholder)
        setEntries(prev => {
          const existing = prev.find(e => e.id === participationId);
          if (existing && existing.name === 'Participant') {
            fetchBoard(); // full re-hydrate for missing name
            return prev;
          }
          return prev; // defer actual score update to the throttled batch
        });

        // Fix #4: accumulate updates, flush after 350ms of silence
        pendingScoreUpdates.current[participationId] = score;
        if (updateThrottleRef.current) clearTimeout(updateThrottleRef.current);
        updateThrottleRef.current = setTimeout(() => {
          const updates = { ...pendingScoreUpdates.current };
          pendingScoreUpdates.current = {};
          updateThrottleRef.current = null;
          setEntries(prev => prev.map(e =>
            updates[e.id] !== undefined ? { ...e, score: updates[e.id] } : e
          ));
        }, 350);
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'participation',
        filter: `event_id=eq.${eventId}`
      }, () => fetchBoard())
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'competitive_quiz_player_state',
        filter: `event_id=eq.${eventId}`
      }, () => {
        if (eventMeta?.type === 'quiz' && eventMeta?.quiz_mode === 'competitive') fetchBoard();
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'treasure_hunt_player_state',
        filter: `event_id=eq.${eventId}`
      }, () => {
        if (eventMeta?.type === 'treasure_hunt') fetchBoard();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          isRealtimeConnectedRef.current = true;
          if (pollerTimer) { clearTimeout(pollerTimer); pollerTimer = null; }
          // Fix #3: re-fetch on reconnect to catch missed updates
          if (wasDisconnected.current) {
            wasDisconnected.current = false;
            fetchBoard();
          }
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          wasDisconnected.current = true;
        }
      });

    let pollerInterval = null;
    pollerTimer = setTimeout(() => {
      if (!isRealtimeConnectedRef.current) {
        pollerInterval = setInterval(fetchBoard, 10000);
      }
    }, 5000);

    return () => {
      clearTimeout(initialFetchTimer);
      supabase.removeChannel(channel);
      if (pollerTimer) clearTimeout(pollerTimer);
      if (pollerInterval) clearInterval(pollerInterval);
      if (updateThrottleRef.current) clearTimeout(updateThrottleRef.current);
    };
  }, [eventId, fetchBoard, eventMeta?.type, eventMeta?.quiz_mode]);

  // Feature 6: Stable mode — maintain a snapshot that refreshes every 2 seconds
  useEffect(() => {
    // Always keep latest entries in the snapshot ref
    stableSnapshotRef.current = entries;
  }, [entries]);

  useEffect(() => {
    if (mode === 'stable') {
      // Immediately show current data as initial snapshot
      setStableEntries(stableSnapshotRef.current);
      stableIntervalRef.current = setInterval(() => {
        setStableEntries([...stableSnapshotRef.current]);
      }, 2000);
    } else {
      // Live mode: clear stable interval
      if (stableIntervalRef.current) {
        clearInterval(stableIntervalRef.current);
        stableIntervalRef.current = null;
      }
    }
    return () => {
      if (stableIntervalRef.current) {
        clearInterval(stableIntervalRef.current);
        stableIntervalRef.current = null;
      }
    };
  }, [mode]);

  // E: Memoize sorted/filtered list — prevents re-sort on every parent render
  // Feature 6: use stableEntries in stable mode, live entries otherwise
  const activeEntries = mode === 'stable' ? stableEntries : entries;
  const renderList = useMemo(() => {
    if (tab === 'solo') {
      return [...activeEntries]
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((e, i) => ({ ...e, rank: i + 1 }));
    }
    const teamMap = {};
    activeEntries.forEach(e => {
      if (!e.team_id) return;
      if (!teamMap[e.team_id]) {
        teamMap[e.team_id] = {
          uniqueId: e.team_id,
          name: e.teamName || 'Unknown Team',
          score: 0,
          members: 0,
          isMe: false,
        };
      }
      teamMap[e.team_id].score += e.score;
      teamMap[e.team_id].members += 1;
      if (e.isMe) teamMap[e.team_id].isMe = true;
    });
    return Object.values(teamMap)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((t, i) => ({ ...t, rank: i + 1 }));
  }, [activeEntries, tab, limit]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: isProjector ? 32 : 16 }}>
      
      {/* Header Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: isProjector ? 32 : 15, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          <Trophy size={isProjector ? 24 : 16} style={{ color: 'var(--amber)' }} /> 
          Top {limit}
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Feature 6: Live / Stable mode toggle */}
          <div className="tab-group">
            <button
              onClick={() => setMode('live')}
              className={`tab-btn ${mode === 'live' ? 'active' : ''}`}
              style={{ fontSize: 11, padding: '4px 10px', height: 28 }}
            >
              <Radio size={12} />
              Live
              {mode === 'live' && <span className="live-dot" style={{ marginLeft: 4 }} />}
            </button>
            <button
              onClick={() => setMode('stable')}
              className={`tab-btn ${mode === 'stable' ? 'active' : ''}`}
              style={{ fontSize: 11, padding: '4px 10px', height: 28 }}
            >
              <Clock size={12} />
              Stable
            </button>
          </div>

          {teamsEnabled && (
            <div className="tab-group">
              <button onClick={() => setTab('solo')} className={`tab-btn ${tab === 'solo' ? 'active' : ''}`} style={{ fontSize: 11, padding: '4px 10px', height: 28 }}>
                <User size={12}/> Solo
              </button>
              <button onClick={() => setTab('team')} className={`tab-btn ${tab === 'team' ? 'active' : ''}`} style={{ fontSize: 11, padding: '4px 10px', height: 28 }}>
                <Users size={12}/> Teams
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Roster */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {renderList.map((item, index) => (
              <div
                key={item.id || item.uniqueId || index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 10,
                  background: item.isMe ? 'rgba(37,99,235,0.08)' : 'var(--surface)',
                  border: `1px solid ${item.isMe ? 'rgba(37,99,235,0.25)' : 'var(--border)'}`,
                  borderRadius: 6,
                  position: 'relative'
                }}
              >
                {/* Rank Badge */}
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 800,
                  flexShrink: 0,
                  background: index === 0 ? 'var(--amber)' : index === 1 ? '#a1a1aa' : index === 2 ? '#b45309' : 'var(--elevated)',
                  color: index === 0 ? '#000' : index === 1 ? '#000' : index === 2 ? '#fff' : 'var(--text-muted)'
                }}>
                  {index + 1}
                </div>

                {/* Avatar */}
                {tab === 'solo' && (
                  <div className="avatar-circle" style={{ width: 28, height: 28, fontSize: 11, flexShrink: 0 }}>
                    {item.avatar 
                      ? <img src={item.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : (item.name?.charAt(0) || '?')
                    }
                  </div>
                )}
                {tab === 'team' && (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Users size={12} style={{ color: '#a855f7' }} />
                  </div>
                )}

                {/* Name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: isProjector ? 20 : 13, fontWeight: 600, color: item.isMe ? 'var(--blue)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.name}
                  </p>
                  {tab === 'team' && <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.members} members</p>}
                  {item.isMe && <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--blue)', marginTop: -2 }}>You</p>}
                </div>

                {/* Score */}
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: isProjector ? 28 : 18, fontWeight: 800, color: 'var(--green)', letterSpacing: '0.04em' }}>
                    {item.score}
                  </p>
                  {isProjector && <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>PTS</p>}
                </div>
              </div>
            ))}

          {renderList.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 8, fontSize: 13 }}>
              No entries found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
