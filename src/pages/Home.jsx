import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';

export function Home() {
  const [featured, setFeatured] = useState([]);

  useEffect(() => {
    async function loadFeatured() {
      const { data } = await supabase
        .from('events')
        .select('*')
        .in('status', ['upcoming', 'live'])
        .order('start_at', { ascending: true })
        .limit(3);
      if (data) setFeatured(data);
    }
    loadFeatured();
  }, []);

  return (
    <div className="flex flex-col min-h-[80vh]">
      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center pt-20 pb-16 text-center">
        <h1 className="text-6xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
          Welcome to EventX
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mb-10">
          The ultimate platform for college events, hackathons, and live competitions. Join, compete, and showcase your skills on the global leaderboard!
        </p>
        <div className="flex gap-4">
          <Link to="/events" className="px-8 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(37,99,235,0.4)]">
            Explore Events
          </Link>
          <Link to="/leaderboard/public" className="px-8 py-3 rounded-full border border-slate-700 hover:bg-slate-800 text-white font-semibold transition-all">
            View Leaderboards
          </Link>
        </div>
      </div>

      {/* Featured Events */}
      {featured.length > 0 && (
        <div className="max-w-6xl mx-auto w-full mt-12 pb-12">
          <div className="flex justify-between items-end mb-6 px-2">
            <h2 className="text-2xl font-bold text-slate-200">Featured Competitions</h2>
            <Link to="/events" className="text-sm font-medium text-blue-400 hover:text-blue-300">View all →</Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featured.map((evt) => (
              <div key={evt.id} className="glass-card p-6 flex flex-col border border-white/5 hover:border-purple-500/30 transition-colors">
                <div className="flex justify-between mb-3">
                  <h3 className="text-lg font-bold text-white truncate">{evt.title}</h3>
                  {evt.status === 'live' && <span className="flex h-3 w-3 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span>}
                </div>
                <p className="text-sm text-slate-400 mb-6 line-clamp-2">{evt.description}</p>
                <Link to={`/events/${evt.id}`} className="mt-auto w-full py-2.5 bg-slate-800 hover:bg-purple-600 rounded-lg text-sm text-center font-medium transition-colors">
                  View Details
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
