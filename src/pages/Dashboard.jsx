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
      
      // Fetch participations linked to their events
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
        setStats({
          joined: data.length,
          bestScore: maxScore
        });
      }
      setLoading(false);
    }
    
    loadDashboard();
  }, [user]);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-12 h-12 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-white mb-2">Welcome, {user.name}</h1>
          <p className="text-slate-400">Ready for your next challenge?</p>
        </div>
        <Link to="/events" className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-lg hover:shadow-blue-500/20 transition-all">
          Find Events
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-card p-6 flex items-center gap-4 border-l-4 border-l-blue-500">
          <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-400 font-medium tracking-wider uppercase">Events Joined</p>
            <p className="text-2xl font-bold text-white">{stats.joined}</p>
          </div>
        </div>
        <div className="glass-card p-6 flex items-center gap-4 border-l-4 border-l-amber-500">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-400 font-medium tracking-wider uppercase">Best Score</p>
            <p className="text-2xl font-bold text-white">{stats.bestScore}</p>
          </div>
        </div>
        <div className="glass-card p-6 flex items-center gap-4 border-l-4 border-l-emerald-500">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-400 font-medium tracking-wider uppercase">Active Live</p>
            <p className="text-2xl font-bold text-white">
              {participations.filter(p => p.events.status === 'live').length}
            </p>
          </div>
        </div>
        <div className="glass-card p-6 flex items-center gap-4 border-l-4 border-l-purple-500">
          <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
            <Star className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-400 font-medium tracking-wider uppercase">Rank</p>
            <p className="text-2xl font-bold text-white">N/A</p>
          </div>
        </div>
      </div>

      {/* Events Board */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-white mb-6">Your Registered Events</h2>
        {participations.length === 0 ? (
          <div className="glass-card p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <CalendarDays className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">You haven't joined any events yet!</h3>
            <p className="text-slate-400 mb-6">Browse the event catalog and join your first hackathon or quiz.</p>
            <Link to="/events" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all">
              Browse Events
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {participations.map((p) => (
              <div key={p.id} className="glass-card flex flex-col p-6 group hover:border-blue-500/30 transition-all border border-white/5 relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-32 h-32 opacity-10 blur-2xl pointer-events-none rounded-full ${p.events.status === 'live' ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
                
                <div className="flex justify-between items-start mb-4 z-10">
                  <span className={`px-2.5 py-1 text-xs rounded-full font-bold tracking-wider uppercase ${
                    p.events.status === 'live' ? 'bg-emerald-500/20 text-emerald-400 animate-pulse' : 
                    p.events.status === 'ended' ? 'bg-slate-500/20 text-slate-400' : 'bg-amber-500/20 text-amber-500'
                  }`}>
                    {p.events.status}
                  </span>
                  <span className="text-xs text-slate-400 font-medium bg-slate-800 px-2.5 py-1 rounded-md uppercase">
                    {p.events.type.replace('_', ' ')}
                  </span>
                </div>
                
                <h3 className="text-xl font-bold text-white mb-6 group-hover:text-blue-400 transition-colors z-10">{p.events.title}</h3>
                
                <div className="mt-auto space-y-4 z-10">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Score</span>
                    <span className="text-white font-bold">{p.score}</span>
                  </div>
                  
                  <Link 
                    to={`/lobby/${p.events.id}`} 
                    className="flex text-center justify-center w-full px-5 py-2.5 bg-slate-800 hover:bg-blue-600 rounded-lg text-sm font-semibold transition-all shadow-lg"
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
