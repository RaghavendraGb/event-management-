import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Link } from 'react-router-dom';
import { 
  BarChart3, Calendar, Users, Award, 
  Activity, ArrowRight, Play, CheckCircle2 
} from 'lucide-react';

export function AdminDashboard() {
  const [stats, setStats] = useState({
    totalEvents: 0,
    activeEvents: 0,
    totalParticipants: 0,
    certificatesMinted: 0
  });
  
  const [recentEvents, setRecentEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDash() {
      // Parallel Aggregations
      const [eventsRes, partsRes, certsRes] = await Promise.all([
        supabase.from('events').select('id, title, status, type, start_at', { count: 'exact' }),
        supabase.from('participation').select('id', { count: 'exact' }),
        supabase.from('certificates').select('id', { count: 'exact' })
      ]);

      const events = eventsRes.data || [];
      const activeCount = events.filter(e => e.status === 'live').length;

      setStats({
        totalEvents: eventsRes.count || 0,
        activeEvents: activeCount,
        totalParticipants: partsRes.count || 0,
        certificatesMinted: certsRes.count || 0
      });

      // Grab recent 5
      setRecentEvents(events.sort((a,b) => new Date(b.start_at) - new Date(a.start_at)).slice(0, 5));
      setLoading(false);
    }
    loadDash();
  }, []);

  if (loading) return <div className="p-10"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;

  const StatCard = ({ title, value, icon: Icon, color, bg }) => (
    <div className="glass-card p-6 flex items-start justify-between">
      <div>
        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-1">{title}</p>
        <h3 className="text-4xl font-black text-white">{value}</h3>
      </div>
      <div className={`p-3 rounded-xl ${bg} ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  );

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-10">
      
      <div>
        <h1 className="text-3xl font-black text-white uppercase tracking-widest mb-2">Command Center</h1>
        <p className="text-slate-400 font-medium">Platform overview and active metrics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Events" value={stats.totalEvents} icon={Calendar} color="text-blue-500" bg="bg-blue-500/20" />
        <StatCard title="Live Events" value={stats.activeEvents} icon={Activity} color="text-emerald-500" bg="bg-emerald-500/20" />
        <StatCard title="Total Registrations" value={stats.totalParticipants} icon={Users} color="text-purple-500" bg="bg-purple-500/20" />
        <StatCard title="Certificates Issued" value={stats.certificatesMinted} icon={Award} color="text-yellow-500" bg="bg-yellow-500/20" />
      </div>

      <div>
        <div className="flex justify-between items-end mb-6">
          <h2 className="text-xl font-bold text-white uppercase tracking-wider">Recent Events</h2>
          <Link to="/admin/events" className="text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors flex flex-row items-center gap-1 uppercase tracking-widest">
            Manage All <ArrowRight className="w-4 h-4"/>
          </Link>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-900 border-b border-white/5">
                <tr>
                  <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest">Event</th>
                  <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest">Type</th>
                  <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest">Status</th>
                  <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentEvents.map(e => (
                  <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4 font-bold text-white text-sm">
                      <Link to={`/admin/events`} className="hover:text-blue-400 transition-colors">{e.title}</Link>
                    </td>
                    <td className="p-4">
                      <span className="text-xs uppercase font-bold tracking-wider text-slate-400 bg-slate-900 px-2 py-1 rounded">
                        {e.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4">
                      {e.status === 'upcoming' && <span className="text-xs font-bold text-blue-400 bg-blue-400/10 px-2 py-1 rounded uppercase tracking-wider">Upcoming</span>}
                      {e.status === 'live' && <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded uppercase tracking-wider animate-pulse flex items-center w-max gap-1"><Play className="w-3 h-3"/> Live</span>}
                      {e.status === 'ended' && <span className="text-xs font-bold text-slate-400 bg-slate-800 px-2 py-1 rounded uppercase tracking-wider flex items-center w-max gap-1"><CheckCircle2 className="w-3 h-3"/> Ended</span>}
                    </td>
                    <td className="p-4 text-xs text-slate-400 font-medium text-right font-mono">
                      {new Date(e.start_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {recentEvents.length === 0 && (
                  <tr>
                    <td colSpan="4" className="p-8 text-center text-slate-500">No events found. Start building!</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
