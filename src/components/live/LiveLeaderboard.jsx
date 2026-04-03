import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Users, User } from 'lucide-react';

export function LiveLeaderboard({ eventId, currentUserId, limit = 10, isProjector = false }) {
  const [participations, setParticipations] = useState([]);
  const [tab, setTab] = useState('solo'); // 'solo' or 'team'
  const [teamsEnabled, setTeamsEnabled] = useState(false);

  const fetchBoard = useCallback(async () => {
    const { data } = await supabase
      .from('participation')
      .select('id, user_id, team_id, score, users(name, avatar_url), teams(name)')
      .eq('event_id', eventId);
      
    if (data) {
      setParticipations(data);
      if (data.some(d => d.team_id)) setTeamsEnabled(true);
    }
  }, [eventId]);

  useEffect(() => {
    fetchBoard();

    // Realtime Sub
    const channel = supabase.channel(`leaderboard-${eventId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'participation', filter: `event_id=eq.${eventId}` }, (payload) => {
         // Update the specific record efficiently
         setParticipations(prev => {
            const index = prev.findIndex(p => p.id === payload.new.id);
            if (index === -1) return prev; // theoretically shouldn't happen unless they joined after mount without realtime insert hook
            const newArray = [...prev];
            newArray[index] = { ...newArray[index], score: payload.new.score };
            return newArray;
         });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'participation', filter: `event_id=eq.${eventId}` }, () => {
         // Re-fetch heavy join on entirely new player
         fetchBoard();
      })
      .subscribe();

    // Fallback Poller
    const poller = setInterval(fetchBoard, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poller);
    };
  }, [eventId, fetchBoard]);

  
  // Computations
  let renderList = [];
  
  if (tab === 'solo') {
    renderList = [...participations]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((p, i) => ({
        uniqueId: p.user_id,
        name: p.users?.name || 'Unknown',
        avatar: p.users?.avatar_url,
        score: p.score,
        isMe: p.user_id === currentUserId
      }));
  } else {
    // Aggregate by Team
    const teamMap = {};
    participations.forEach(p => {
      if (!p.team_id) return;
      if (!teamMap[p.team_id]) {
        teamMap[p.team_id] = {
           uniqueId: p.team_id,
           name: p.teams?.name || 'Unknown Team',
           score: 0,
           members: 0,
           isMe: false
        };
      }
      teamMap[p.team_id].score += p.score;
      teamMap[p.team_id].members += 1;
      if (p.user_id === currentUserId) teamMap[p.team_id].isMe = true;
    });
    
    renderList = Object.values(teamMap)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  return (
    <div className={`flex flex-col h-full w-full ${isProjector ? 'p-8' : 'p-4'}`}>
      
      {/* Header Tabs */}
      <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
        <h2 className={`${isProjector ? 'text-4xl' : 'text-xl'} font-black text-white flex items-center gap-2 tracking-widest uppercase`}>
          <Trophy className={`${isProjector ? 'w-8 h-8' : 'w-5 h-5'} text-amber-400`} /> 
          Top 10
        </h2>
        
        {teamsEnabled && (
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button onClick={() => setTab('solo')} className={`px-3 py-1 text-xs font-bold rounded flex flex-col items-center gap-1 transition-all ${tab === 'solo' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
              <User className="w-4 h-4"/>
            </button>
            <button onClick={() => setTab('team')} className={`px-3 py-1 text-xs font-bold rounded flex flex-col items-center gap-1 transition-all ${tab === 'team' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
              <Users className="w-4 h-4"/>
            </button>
          </div>
        )}
      </div>

      {/* Roster Layout using Framer Motion */}
      <div className="flex-1 relative">
        <div className="space-y-3 relative w-full">
          <AnimatePresence>
            {renderList.map((item, index) => (
              <motion.div
                key={item.uniqueId}
                layout
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4, type: "spring", bounce: 0.3 }}
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

                {/* Avatar if Solo */}
                {tab === 'solo' && (
                  <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden shrink-0 border border-slate-700">
                    {item.avatar ? <img src={item.avatar} alt="Avatar" className="w-full h-full object-cover" /> : <User className="w-full h-full p-1.5 text-slate-500" />}
                  </div>
                )}
                {/* Icon if Team */}
                {tab === 'team' && (
                   <div className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                     <Users className="w-4 h-4"/>
                   </div>
                )}

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className={`font-bold truncate ${item.isMe ? 'text-blue-400' : 'text-slate-200'} ${isProjector ? 'text-2xl' : 'text-sm'}`}>{item.name}</p>
                  {tab === 'team' && <p className="text-xs text-purple-400">{item.members} Members</p>}
                  {item.isMe && <p className="text-[10px] uppercase font-black tracking-widest text-blue-500 -mt-1">You</p>}
                </div>

                {/* Score */}
                <div className="text-right">
                   <p className={`font-black tracking-wider ${isProjector ? 'text-4xl text-emerald-400' : 'text-xl text-emerald-400'}`}>{item.score}</p>
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
