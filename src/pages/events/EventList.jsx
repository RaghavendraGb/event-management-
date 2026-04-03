import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import { Users, CalendarDays } from 'lucide-react';

export function EventList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getEvents() {
      // Supabase trick to get count natively without giant payloads:
      // select('*, participation(count)')
      const { data } = await supabase
        .from('events')
        .select(`
          *,
          participation:participation(count)
        `)
        .in('status', ['upcoming', 'live'])
        .order('start_at', { ascending: true });
      
      if (data) setEvents(data);
      setLoading(false);
    }
    getEvents();
  }, []);

  return (
    <div className="max-w-6xl mx-auto pb-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold text-white mb-4">Discover Events</h1>
        <p className="text-slate-400 max-w-2xl mx-auto">Browse active hackathons, quizzes, and treasure hunts happening globally. Join solo or build a team to conquer the leaderboards.</p>
      </div>
      
      {loading ? (
        <div className="flex justify-center p-12">
          <div className="w-12 h-12 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
      ) : events.length === 0 ? (
        <div className="glass-card p-12 text-center flex flex-col items-center">
          <CalendarDays className="w-16 h-16 text-slate-600 mb-4" />
          <h3 className="text-2xl font-bold text-white mb-2">No active events</h3>
          <p className="text-slate-400">Check back later when organizers publish new competitions!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {events.map((evt) => {
            const participantCount = evt.participation[0]?.count || 0;
            const isFull = evt.max_participants && participantCount >= evt.max_participants;

            return (
              <Link to={`/events/${evt.id}`} key={evt.id} className="glass-card flex flex-col group hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(37,99,235,0.15)] transition-all overflow-hidden relative">
                {/* Visual Header Graphic */}
                <div className="h-32 bg-slate-900 border-b border-white/5 relative overflow-hidden flex items-center justify-center">
                  <div className={`absolute inset-0 opacity-20 ${evt.status === 'live' ? 'bg-gradient-to-br from-emerald-500 to-teal-900' : 'bg-gradient-to-br from-blue-500 to-indigo-900'}`}></div>
                  <div className="z-10 bg-slate-950/50 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 uppercase tracking-widest text-xs font-bold text-white shadow-xl">
                    {evt.type.replace('_', ' ')}
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <span className={`px-2.5 py-1 text-xs rounded-full font-bold uppercase tracking-wide inline-flex items-center gap-1.5 ${
                      evt.status === 'live' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-500'
                    }`}>
                      {evt.status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>}
                      {evt.status}
                    </span>
                    
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded">
                      <Users className="w-3.5 h-3.5" />
                      {participantCount} {evt.max_participants ? `/ ${evt.max_participants}` : ''}
                    </span>
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-3 group-hover:text-blue-400 transition-colors">{evt.title}</h3>
                  <p className="text-sm text-slate-400 mb-6 line-clamp-2">
                    {evt.description || 'Join the most exciting hackathon of the year and build amazing projects!'}
                  </p>
                  
                  <div className="mt-auto pt-4 flex items-center justify-between border-t border-white/5 pb-2">
                    <span className="text-sm text-slate-300 font-medium flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-blue-500" />
                      {new Date(evt.start_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    <span className={`text-sm font-bold ${isFull ? 'text-red-400' : 'text-blue-400'}`}>
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
