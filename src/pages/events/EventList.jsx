import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import { Users, CalendarDays } from 'lucide-react';

export function EventList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getEvents() {
      const { data } = await supabase
        .from('events')
        .select(`*, participation:participation(count)`)
        .in('status', ['upcoming', 'live'])
        .order('start_at', { ascending: true });
      
      if (data) setEvents(data);
      setLoading(false);
    }
    getEvents();
  }, []);

  return (
    <div className="max-w-6xl mx-auto pb-8">
      <div className="text-center mb-8 sm:mb-12 px-4">
        <h1 className="text-2xl sm:text-4xl font-extrabold text-white mb-3">Discover Events</h1>
        <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Browse active hackathons, quizzes, and treasure hunts. Join solo or build a team to conquer the leaderboards.
        </p>
      </div>
      
      {loading ? (
        <div className="flex justify-center p-12">
          <div className="w-12 h-12 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <div className="glass-card p-8 sm:p-12 text-center flex flex-col items-center mx-4">
          <CalendarDays className="w-14 h-14 text-slate-600 mb-4" />
          <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">No active events</h3>
          <p className="text-slate-400 text-sm">Check back later when organizers publish new competitions!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 sm:gap-8 px-0">
          {events.map((evt) => {
            const participantCount = evt.participation?.[0]?.count || 0;
            const isFull = evt.max_participants && participantCount >= evt.max_participants;

            return (
              <Link 
                to={`/events/${evt.id}`} 
                key={evt.id} 
                className="glass-card flex flex-col group hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(37,99,235,0.15)] transition-all overflow-hidden relative min-w-0"
              >
                {/* Visual Header */}
                <div className="h-24 sm:h-32 bg-slate-900 border-b border-white/5 relative overflow-hidden flex items-center justify-center shrink-0">
                  <div className={`absolute inset-0 opacity-20 ${evt.status === 'live' ? 'bg-gradient-to-br from-emerald-500 to-teal-900' : 'bg-gradient-to-br from-blue-500 to-indigo-900'}`} />
                  <div className="z-10 bg-slate-950/50 backdrop-blur-md px-4 sm:px-6 py-1.5 rounded-full border border-white/10 uppercase tracking-widest text-xs font-bold text-white shadow-xl">
                    {evt.type.replace('_', ' ')}
                  </div>
                </div>

                <div className="p-4 sm:p-6 flex-1 flex flex-col min-w-0">
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <span className={`px-2 py-1 text-[10px] sm:text-xs rounded-full font-bold uppercase tracking-wide inline-flex items-center gap-1 shrink-0 ${
                      evt.status === 'live' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-500'
                    }`}>
                      {evt.status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                      {evt.status}
                    </span>
                    
                    <span className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-slate-400 bg-slate-800/80 px-2 py-1 rounded shrink-0">
                      <Users className="w-3 h-3" />
                      {participantCount}{evt.max_participants ? ` / ${evt.max_participants}` : ''}
                    </span>
                  </div>
                  
                  <h3 className="text-base sm:text-xl font-bold text-white mb-2 sm:mb-3 group-hover:text-blue-400 transition-colors truncate">
                    {evt.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 mb-4 sm:mb-6 line-clamp-2 leading-relaxed flex-1">
                    {evt.description || 'Join the most exciting hackathon of the year and build amazing projects!'}
                  </p>
                  
                  <div className="mt-auto pt-3 flex items-center justify-between border-t border-white/5">
                    <span className="text-xs sm:text-sm text-slate-300 font-medium flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      {new Date(evt.start_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    <span className={`text-xs sm:text-sm font-bold ${isFull ? 'text-red-400' : 'text-blue-400'}`}>
                      {isFull ? 'Full' : 'Join →'}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
