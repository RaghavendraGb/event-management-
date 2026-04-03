import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { CalendarDays, Trophy, Zap } from 'lucide-react';

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
      <div className="flex flex-col items-center justify-center pt-10 pb-12 sm:pt-16 sm:pb-16 text-center px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest mb-6">
          <Zap className="w-3.5 h-3.5 shrink-0" />
          Live Competition Platform
        </div>

        <h1 className="text-hero font-extrabold mb-5 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 leading-tight">
          Welcome to EventX
        </h1>
        <p className="text-sm sm:text-base md:text-lg text-slate-400 max-w-xl mb-8 leading-relaxed">
          The ultimate platform for college events, hackathons, and live competitions. Join, compete, and showcase your skills on the global leaderboard!
        </p>

        {/* CTA buttons — stack on phone, row on tablet+ */}
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-none sm:w-auto">
          <Link 
            to="/events" 
            className="px-7 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(37,99,235,0.4)] text-center text-sm sm:text-base"
          >
            Explore Events
          </Link>
          <Link 
            to="/leaderboard/public" 
            className="px-7 py-3 rounded-full border border-slate-700 hover:bg-slate-800 text-white font-semibold transition-all text-center text-sm sm:text-base"
          >
            View Leaderboards
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      <div className="w-full max-w-4xl mx-auto px-4 mb-12 grid grid-cols-3 gap-3">
        {[
          { icon: CalendarDays, label: 'Events', value: '10+', color: 'text-blue-400' },
          { icon: Trophy,       label: 'Winners', value: '500+', color: 'text-amber-400' },
          { icon: Zap,          label: 'Live Now', value: '3',  color: 'text-emerald-400' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="glass-card p-3 sm:p-5 flex flex-col items-center text-center gap-1">
            <Icon className={`w-5 h-5 sm:w-7 sm:h-7 ${color} shrink-0`} />
            <p className={`text-lg sm:text-2xl font-black ${color}`}>{value}</p>
            <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-widest">{label}</p>
          </div>
        ))}
      </div>

      {/* Featured Events */}
      {featured.length > 0 && (
        <div className="max-w-6xl mx-auto w-full pb-8 px-4">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-section font-bold text-slate-200">Featured Competitions</h2>
            <Link to="/events" className="text-xs sm:text-sm font-medium text-blue-400 hover:text-blue-300 shrink-0 ml-4">
              View all →
            </Link>
          </div>
          
          {/* Horizontal scroll on mobile, grid on tablet+ */}
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-visible sm:pb-0 sm:mx-0 sm:px-0 snap-x snap-mandatory sm:snap-none">
            {featured.map((evt) => (
              <div 
                key={evt.id} 
                className="glass-card p-5 flex flex-col border border-white/5 hover:border-purple-500/30 transition-colors flex-shrink-0 w-72 sm:w-auto snap-start"
              >
                <div className="flex justify-between items-start mb-3 gap-2">
                  <h3 className="text-base font-bold text-white truncate flex-1">{evt.title}</h3>
                  {evt.status === 'live' && (
                    <span className="flex h-2.5 w-2.5 shrink-0 relative mt-1">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mb-5 line-clamp-2 leading-relaxed">{evt.description}</p>
                <Link 
                  to={`/events/${evt.id}`} 
                  className="mt-auto w-full py-2.5 bg-slate-800 hover:bg-purple-600 rounded-lg text-xs text-center font-semibold transition-colors"
                >
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
