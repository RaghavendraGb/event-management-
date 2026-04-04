import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Users, User, Radio, Clock } from 'lucide-react';

export function LiveLeaderboard({ eventId, currentUserId, limit = 10, isProjector = false }) {
  const [entries, setEntries] = useState([]);
  const [tab, setTab] = useState('solo');
  const [teamsEnabled, setTeamsEnabled] = useState(false);
  // Feature 6: stable mode — 'live' updates instantly; 'stable' snapshots every 2s
  const [mode, setMode] = useState(isProjector ? 'stable' : 'live');
  const stableSnapshotRef = useRef([]);   // last stable snapshot
  const [stableEntries, setStableEntries] = useState([]); // displayed in stable mode
  const stableIntervalRef = useRef(null);

  // Fix #4: throttle timer ref — batches rapid score updates into one re-render
  const updateThrottleRef = useRef(null);
  const pendingScoreUpdates = useRef({});  // { participationId: newScore }

  const fetchBoard = useCallback(async () => {
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
  }, [eventId, currentUserId]);

  useEffect(() => {
    fetchBoard();

    const isRealtimeConnectedRef = { current: false };
    // Fix #3: track prior disconnect so we can re-sync on reconnect
    const wasDisconnected = { current: false };
    let pollerTimer = null;

    const channel = supabase.channel(`leaderboard-${eventId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'participation',
        filter: `event_id=eq.${eventId}`
      }, (payload) => {
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
      supabase.removeChannel(channel);
      if (pollerTimer) clearTimeout(pollerTimer);
      if (pollerInterval) clearInterval(pollerInterval);
      if (updateThrottleRef.current) clearTimeout(updateThrottleRef.current);
    };
  }, [eventId, fetchBoard]);

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
  }, [activeEntries, tab, limit, mode]);

  return (
    <div className={`flex flex-col h-full w-full ${isProjector ? 'p-8' : 'p-4'}`}>
      
      {/* Header Tabs */}
      <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4 gap-2 flex-wrap">
        <h2 className={`${isProjector ? 'text-4xl' : 'text-xl'} font-black text-white flex items-center gap-2 tracking-widest uppercase`}>
          <Trophy className={`${isProjector ? 'w-8 h-8' : 'w-5 h-5'} text-amber-400`} /> 
          Top {limit}
        </h2>

        <div className="flex items-center gap-2">
          {/* Feature 6: Live / Stable mode toggle */}
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setMode('live')}
              className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-1 transition-all ${mode === 'live' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Radio className="w-3 h-3" />
              {mode === 'live' && <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" /></span>}
              Live
            </button>
            <button
              onClick={() => setMode('stable')}
              className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-1 transition-all ${mode === 'stable' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Clock className="w-3 h-3" />
              Stable
            </button>
          </div>

          {teamsEnabled && (
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button onClick={() => setTab('solo')} className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-1 transition-all ${tab === 'solo' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                <User className="w-4 h-4"/>Solo
              </button>
              <button onClick={() => setTab('team')} className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-1 transition-all ${tab === 'team' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                <Users className="w-4 h-4"/>Teams
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Roster */}
      <div className="flex-1 relative">
        <div className="space-y-3 relative w-full">
          <AnimatePresence>
            {renderList.map((item, index) => (
              <motion.div
                key={item.id || item.uniqueId || index}
                layout
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4, type: 'spring', bounce: 0.3 }}
                className={`flex items-center gap-4 w-full rounded-xl border p-3 ${
                  item.isMe 
                  ? 'bg-blue-600/20 border-blue-500/50 shadow-[0_0_20px_rgba(37,99,235,0.2)]' 
                  : 'bg-slate-900 border-white/5 shadow-lg'
                }`}
              >
                {/* Rank Badge */}
                <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center font-black ${
                  index === 0 ? 'bg-amber-500 text-amber-950 shadow-[0_0_15px_rgba(245,158,11,0.5)]' :
                  index === 1 ? 'bg-slate-300 text-slate-800' :
                  index === 2 ? 'bg-amber-700 text-amber-100' : 'bg-slate-800 text-slate-400'
                }`}>
                  {index + 1}
                </div>

                {/* Avatar */}
                {tab === 'solo' && (
                  <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden shrink-0 border border-slate-700">
                    {item.avatar 
                      ? <img src={item.avatar} alt="Avatar" className="w-full h-full object-cover" />
                      : <User className="w-full h-full p-1.5 text-slate-500" />
                    }
                  </div>
                )}
                {tab === 'team' && (
                  <div className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    <Users className="w-4 h-4"/>
                  </div>
                )}

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className={`font-bold truncate ${item.isMe ? 'text-blue-400' : 'text-slate-200'} ${isProjector ? 'text-2xl' : 'text-sm'}`}>
                    {item.name}
                  </p>
                  {tab === 'team' && <p className="text-xs text-purple-400">{item.members} Members</p>}
                  {item.isMe && <p className="text-[10px] uppercase font-black tracking-widest text-blue-500 -mt-1">You</p>}
                </div>

                {/* Score */}
                <div className="text-right">
                  <p className={`font-black tracking-wider ${isProjector ? 'text-4xl text-emerald-400' : 'text-xl text-emerald-400'}`}>
                    {item.score}
                  </p>
                  {isProjector && <p className="text-xs uppercase text-slate-500 font-bold tracking-widest mt-[-2px]">Score</p>}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {renderList.length === 0 && (
            <div className="text-center p-10 text-slate-500 border border-dashed border-slate-800 rounded-xl">
              No participants on the board yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
