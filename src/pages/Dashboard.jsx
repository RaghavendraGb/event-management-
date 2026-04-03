import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { Trophy, CalendarDays, Activity, Star } from 'lucide-react';

export function Dashboard() {
  const user = useStore((state) => state.user);
  const [participations, setParticipations] = useState([]);
  const [stats, setStats] = useState({ joined: 0, bestScore: 0 });
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
        setStats({ joined: data.length, bestScore: maxScore });
      }
      setLoading(false);
    }
    loadDashboard();
  }, [user]);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-12 h-12 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-1 truncate">
            Welcome, {user.name}
          </h1>
          <p className="text-slate-400 text-sm">Ready for your next challenge?</p>
        </div>
        <Link 
          to="/events" 
          className="self-start sm:self-auto shrink-0 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-lg hover:shadow-blue-500/20 transition-all"
        >
          Find Events
        </Link>
      </div>

      {/* Stats Row — 2-col on mobile, 4-col on md+ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[
          { icon: CalendarDays, label: 'Events Joined',   value: stats.joined,     color: 'border-l-blue-500',    accent: 'bg-blue-500/20 text-blue-400' },
          { icon: Trophy,       label: 'Best Score',      value: stats.bestScore,  color: 'border-l-amber-500',   accent: 'bg-amber-500/20 text-amber-400' },
          { icon: Activity,     label: 'Active Live',     value: participations.filter(p => p.events?.status === 'live').length, color: 'border-l-emerald-500', accent: 'bg-emerald-500/20 text-emerald-400' },
          { icon: Star,         label: 'Rank',            value: 'N/A',            color: 'border-l-purple-500',  accent: 'bg-purple-500/20 text-purple-400' },
        ].map(({ icon: Icon, label, value, color, accent }) => (
          <div key={label} className={`glass-card p-4 sm:p-6 flex items-center gap-3 border-l-4 ${color} min-w-0`}>
            <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-full ${accent} flex items-center justify-center shrink-0`}>
              <Icon className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-slate-400 font-medium tracking-wider uppercase truncate">{label}</p>
              <p className="text-xl sm:text-2xl font-bold text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Events Board */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">Your Registered Events</h2>
        {participations.length === 0 ? (
          <div className="glass-card p-8 sm:p-12 text-center flex flex-col items-center">
            <div className="w-14 h-14 bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <CalendarDays className="w-7 h-7 text-slate-500" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white mb-2">No events joined yet!</h3>
            <p className="text-slate-400 text-sm mb-6 max-w-sm">Browse the event catalog and join your first hackathon or quiz.</p>
            <Link to="/events" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all text-sm">
              Browse Events
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {participations.map((p) => (
              <div key={p.id} className="glass-card flex flex-col p-5 group hover:border-blue-500/30 transition-all border border-white/5 relative overflow-hidden min-w-0">
                <div className={`absolute top-0 right-0 w-24 h-24 opacity-10 blur-2xl pointer-events-none rounded-full ${p.events?.status === 'live' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                
                <div className="flex justify-between items-start mb-3 z-10 gap-2">
                  <span className={`px-2 py-1 text-[10px] rounded-full font-bold tracking-wider uppercase shrink-0 ${
                    p.events?.status === 'live' ? 'bg-emerald-500/20 text-emerald-400 animate-pulse' : 
                    p.events?.status === 'ended' ? 'bg-slate-500/20 text-slate-400' : 'bg-amber-500/20 text-amber-500'
                  }`}>
                    {p.events?.status}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium bg-slate-800 px-2 py-1 rounded uppercase truncate">
                    {p.events?.type?.replace('_', ' ')}
                  </span>
                </div>
                
                <h3 className="text-base sm:text-lg font-bold text-white mb-4 group-hover:text-blue-400 transition-colors z-10 truncate">
                  {p.events?.title}
                </h3>
                
                <div className="mt-auto space-y-3 z-10">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Score</span>
                    <span className="text-white font-bold">{p.score}</span>
                  </div>
                  <Link 
                    to={`/lobby/${p.events?.id}`} 
                    className="flex text-center justify-center w-full px-4 py-2.5 bg-slate-800 hover:bg-blue-600 rounded-xl text-sm font-semibold transition-all"
                  >
                    View Ticket / Lobby
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
